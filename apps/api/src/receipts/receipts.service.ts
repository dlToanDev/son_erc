import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ConfirmReceiptResult, ReceiptData } from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { purchaseTotals } from '../domain';
import { nextReceiptCode } from '../common/codes';
import { CreateReceiptDto } from './dto/receipt.dto';

const RECEIPT_INCLUDE = {
  items: true,
  supplier: { select: { name: true } },
  facility: { select: { name: true } },
  payable: { select: { id: true } },
} satisfies Prisma.PurchaseReceiptInclude;

type ReceiptRow = Prisma.PurchaseReceiptGetPayload<{ include: typeof RECEIPT_INCLUDE }>;

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(filter: {
    supplierId?: string;
    facilityId?: string;
    status?: string;
  }): Promise<ReceiptData[]> {
    const ids = filter.facilityId ? filter.facilityId.split(',').filter(Boolean) : [];
    const facilityWhere = ids.length === 1 ? ids[0] : ids.length > 1 ? { in: ids } : undefined;

    const receipts = await this.prisma.purchaseReceipt.findMany({
      where: {
        supplierId: filter.supplierId || undefined,
        facilityId: facilityWhere,
        status: (filter.status as 'DRAFT' | 'CONFIRMED') || undefined,
      },
      include: RECEIPT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return receipts.map((r) => this.serialize(r));
  }

  async findOne(id: string): Promise<ReceiptData> {
    const receipt = await this.prisma.purchaseReceipt.findUnique({
      where: { id },
      include: RECEIPT_INCLUDE,
    });
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập');
    return this.serialize(receipt);
  }

  /** Tạo phiếu nhập DRAFT nhiều dòng nhập tay (tên hàng, ĐVT, SL, đơn giá). */
  async create(dto: CreateReceiptDto, userId: string): Promise<ReceiptData> {
    const [supplier, facility] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId }, select: { status: true } }),
      this.prisma.facility.findUnique({ where: { id: dto.facilityId }, select: { status: true } }),
    ]);
    if (!supplier || supplier.status !== 'ACTIVE') {
      throw new BadRequestException('Nhà cung cấp không hợp lệ hoặc đã ẩn');
    }
    if (!facility || facility.status !== 'ACTIVE') {
      throw new BadRequestException('Cơ sở không hợp lệ hoặc đã ẩn');
    }

    const receiptCode = await nextReceiptCode(this.prisma);
    const receipt = await this.prisma.purchaseReceipt.create({
      data: {
        receiptCode,
        supplierId: dto.supplierId,
        facilityId: dto.facilityId,
        supplierInvoiceCode: dto.supplierInvoiceCode,
        receiptDate: new Date(dto.receiptDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        discountAmount: dto.discountAmount ?? 0,
        taxAmount: dto.taxAmount ?? 0,
        note: dto.note,
        createdBy: userId,
        items: { create: dto.items },
      },
      include: RECEIPT_INCLUDE,
    });

    await this.audit.log({
      userId,
      action: 'CREATE_RECEIPT',
      entityType: 'RECEIPT',
      entityId: receipt.id,
      detail: `Tạo phiếu nhập ${receiptCode} (${dto.items.length} dòng, DRAFT)`,
    });
    return this.serialize(receipt);
  }

  /**
   * XÁC NHẬN — 1 TRANSACTION: khoá dòng → kiểm DRAFT → CONFIRMED
   * → sinh Payable(grandTotal) → audit. Lỗi ⇒ rollback.
   */
  async confirm(id: string, userId: string): Promise<ConfirmReceiptResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM purchase_receipts WHERE id = ${id} FOR UPDATE`;

        const receipt = await tx.purchaseReceipt.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập');
        if (receipt.status !== 'DRAFT') {
          throw new ConflictException(`Chỉ xác nhận được phiếu DRAFT (hiện tại: ${receipt.status})`);
        }

        const totals = purchaseTotals(
          receipt.items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
          Number(receipt.discountAmount),
          Number(receipt.taxAmount),
        );

        const payable = await tx.payable.create({
          data: {
            // Ưu tiên số hoá đơn NCC; không có thì dùng mã phiếu nhập.
            invoiceCode: receipt.supplierInvoiceCode ?? receipt.receiptCode,
            supplierId: receipt.supplierId,
            purchaseReceiptId: receipt.id,
            invoiceDate: receipt.receiptDate,
            dueDate: receipt.dueDate,
            totalAmount: totals.grandTotal,
            description: `Công nợ từ phiếu nhập ${receipt.receiptCode}`,
            createdBy: userId,
          },
        });

        const updated = await tx.purchaseReceipt.update({
          where: { id },
          data: { status: 'CONFIRMED', confirmedBy: userId },
          include: RECEIPT_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: 'CONFIRM_RECEIPT',
            entityType: 'RECEIPT',
            entityId: id,
            detail: `Xác nhận phiếu nhập ${receipt.receiptCode} → công nợ ${totals.grandTotal.toLocaleString('vi-VN')}đ`,
          },
        });

        return { receipt: updated, payable };
      });

      return {
        receipt: this.serialize(result.receipt),
        payable: {
          id: result.payable.id,
          invoiceCode: result.payable.invoiceCode,
          supplierId: result.payable.supplierId,
          supplierName: result.receipt.supplier.name,
          purchaseReceiptId: result.payable.purchaseReceiptId,
          receiptCode: result.receipt.receiptCode,
          invoiceDate: result.payable.invoiceDate.toISOString(),
          dueDate: result.payable.dueDate?.toISOString() ?? null,
          totalAmount: Number(result.payable.totalAmount),
          paid: 0,
          balance: Number(result.payable.totalAmount),
          status: 'UNPAID',
          description: result.payable.description,
          note: result.payable.note,
          createdAt: result.payable.createdAt.toISOString(),
        },
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Số hoá đơn NCC đã tồn tại trong công nợ — kiểm tra lại supplierInvoiceCode',
        );
      }
      throw e;
    }
  }

  private serialize(r: ReceiptRow): ReceiptData {
    const items = r.items.map((i) => ({
      id: i.id,
      itemName: i.itemName,
      unit: i.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      note: i.note,
    }));
    const totals = purchaseTotals(
      items,
      Number(r.discountAmount),
      Number(r.taxAmount),
    );
    return {
      id: r.id,
      receiptCode: r.receiptCode,
      supplierId: r.supplierId,
      supplierName: r.supplier.name,
      facilityId: r.facilityId,
      facilityName: r.facility.name,
      supplierInvoiceCode: r.supplierInvoiceCode,
      receiptDate: r.receiptDate.toISOString(),
      dueDate: r.dueDate?.toISOString() ?? null,
      status: r.status,
      discountAmount: Number(r.discountAmount),
      taxAmount: Number(r.taxAmount),
      note: r.note,
      createdBy: r.createdBy,
      confirmedBy: r.confirmedBy,
      createdAt: r.createdAt.toISOString(),
      items,
      subtotal: totals.subtotal,
      grandTotal: totals.grandTotal,
      payableId: r.payable?.id ?? null,
    };
  }
}
