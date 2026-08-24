import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApproveOrderResult, PurchaseOrderData } from '@debtflow/shared';
import { RequestUser } from '../auth/jwt.constants';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { purchaseTotals } from '../domain';
import { nextOrderCode, nextReceiptCode } from '../common/codes';
import { CreateOrderDto, RejectOrderDto, UpdateOrderDto } from './dto/order.dto';

/** Công nợ mặc định đáo hạn sau 30 ngày kể từ ngày duyệt. */
const DEFAULT_DUE_DAYS = 30;

const ORDER_INCLUDE = {
  items: true,
  supplier: { select: { name: true } },
  facility: { select: { name: true } },
} satisfies Prisma.PurchaseOrderInclude;

type OrderRow = Prisma.PurchaseOrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(filter: { facilityId?: string; status?: string }): Promise<PurchaseOrderData[]> {
    const ids = filter.facilityId ? filter.facilityId.split(',').filter(Boolean) : [];
    const facilityWhere = ids.length === 1 ? ids[0] : ids.length > 1 ? { in: ids } : undefined;

    const orders = await this.prisma.purchaseOrder.findMany({
      where: {
        facilityId: facilityWhere,
        status: (filter.status as Prisma.EnumOrderStatusFilter['equals']) || undefined,
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(orders.map((o) => this.serialize(o)));
  }

  async findOne(id: string, user?: RequestUser): Promise<PurchaseOrderData> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    if (user?.role !== 'ADMIN' && order.status === 'APPROVED') {
      throw new ForbiddenException('Đơn hàng đã được duyệt. Nhân viên không được phép xem chi tiết.');
    }

    return this.serialize(order);
  }

  /** Số đơn PENDING — badge sidebar admin. */
  async pendingCount(): Promise<{ count: number }> {
    const count = await this.prisma.purchaseOrder.count({ where: { status: 'PENDING' } });
    return { count };
  }

  /** Tạo đơn: giá/tên/ĐVT snapshot server-side từ danh mục NCC. */
  async create(dto: CreateOrderDto, userId: string): Promise<PurchaseOrderData> {
    const [supplier, facility] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId }, select: { id: true, status: true } }),
      this.prisma.facility.findUnique({ where: { id: dto.facilityId }, select: { id: true, status: true } }),
    ]);
    if (!supplier || supplier.status !== 'ACTIVE') {
      throw new BadRequestException('Nhà cung cấp không hợp lệ hoặc đã ẩn');
    }
    if (!facility || facility.status !== 'ACTIVE') {
      throw new BadRequestException('Cơ sở không hợp lệ hoặc đã ẩn');
    }

    // Snapshot từ danh mục — không tin giá từ client.
    const products = await this.prisma.supplierProduct.findMany({
      where: {
        id: { in: dto.items.map((i) => i.productId) },
        supplierId: dto.supplierId,
        status: 'ACTIVE',
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      if (!productMap.has(item.productId)) {
        throw new BadRequestException(`Mặt hàng ${item.productId} không thuộc NCC hoặc đã ẩn`);
      }
    }

    const orderCode = await nextOrderCode(this.prisma);
    const order = await this.prisma.purchaseOrder.create({
      data: {
        orderCode,
        supplierId: dto.supplierId,
        facilityId: dto.facilityId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        note: dto.note,
        createdBy: userId,
        items: {
          create: dto.items.map((i) => {
            const p = productMap.get(i.productId)!;
            return {
              productId: p.id,
              name: p.name,
              unit: p.unit,
              unitPrice: p.price, // snapshot
              quantity: i.quantity,
            };
          }),
        },
      },
      include: ORDER_INCLUDE,
    });

    await this.audit.log({
      userId,
      action: 'CREATE_ORDER',
      entityType: 'ORDER',
      entityId: order.id,
      detail: `Tạo đơn ${orderCode} (${dto.items.length} dòng)`,
    });
    return this.serialize(order);
  }

  /**
   * DUYỆT ĐƠN — TRỌN VẸN TRONG 1 TRANSACTION:
   * khoá dòng → kiểm PENDING → sinh Receipt(CONFIRMED) → sinh Payable
   * → cập nhật order → ghi audit. Lỗi bất kỳ ⇒ rollback toàn bộ.
   */
  async approve(id: string, approverId: string, customDueDate?: string): Promise<ApproveOrderResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Khoá dòng chống duyệt đồng thời.
        await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;

        const order = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
        if (order.status !== 'PENDING') {
          throw new ConflictException(`Chỉ duyệt được đơn PENDING (hiện tại: ${order.status})`);
        }

        const now = new Date();
        const dueDate = customDueDate
          ? new Date(customDueDate)
          : new Date(now.getTime() + DEFAULT_DUE_DAYS * 86400000);
        const totals = purchaseTotals(
          order.items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
        );

        const receiptCode = await nextReceiptCode(tx);
        const receipt = await tx.purchaseReceipt.create({
          data: {
            receiptCode,
            supplierId: order.supplierId,
            facilityId: order.facilityId,
            receiptDate: now,
            dueDate,
            status: 'CONFIRMED',
            note: `Sinh từ đơn ${order.orderCode}`,
            createdBy: approverId,
            confirmedBy: approverId,
            items: {
              create: order.items.map((i) => ({
                itemName: i.name,
                unit: i.unit,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
              })),
            },
          },
        });

        const payable = await tx.payable.create({
          data: {
            invoiceCode: receiptCode, // 1:1 với phiếu nhập
            supplierId: order.supplierId,
            purchaseReceiptId: receipt.id,
            invoiceDate: now,
            dueDate,
            totalAmount: totals.grandTotal,
            description: `Công nợ từ đơn ${order.orderCode}`,
            createdBy: approverId,
          },
        });

        const updated = await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewedBy: approverId,
            reviewedAt: now,
            resultReceiptId: receipt.id,
            resultPayableId: payable.id,
          },
          include: ORDER_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            userId: approverId,
            action: 'APPROVE_ORDER',
            entityType: 'ORDER',
            entityId: id,
            detail: `Duyệt đơn ${order.orderCode} → phiếu nhập ${receiptCode} + công nợ ${totals.grandTotal.toLocaleString('vi-VN')}đ`,
          },
        });

        return { order: updated, receipt, payable };
      });

      return {
        order: await this.serialize(result.order as OrderRow),
        receipt: {
          id: result.receipt.id,
          receiptCode: result.receipt.receiptCode,
          status: result.receipt.status,
          totalAmount: Number(result.payable.totalAmount),
        },
        payable: {
          id: result.payable.id,
          invoiceCode: result.payable.invoiceCode,
          totalAmount: Number(result.payable.totalAmount),
          dueDate: result.payable.dueDate?.toISOString() ?? null,
        },
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Trùng mã chứng từ, vui lòng thử lại');
      }
      throw e;
    }
  }

  /** Từ chối: PENDING → REJECTED kèm lý do. */
  async reject(id: string, dto: RejectOrderDto, reviewerId: string): Promise<PurchaseOrderData> {
    const order = await this.transition(id, 'REJECTED', reviewerId, dto.reason);
    await this.audit.log({
      userId: reviewerId,
      action: 'REJECT_ORDER',
      entityType: 'ORDER',
      entityId: id,
      detail: `Từ chối đơn ${order.orderCode}: ${dto.reason}`,
    });
    return this.serialize(order);
  }

  /** Huỷ (staff huỷ khi chưa duyệt): PENDING → CANCELLED. */
  async cancel(id: string, userId: string): Promise<PurchaseOrderData> {
    const order = await this.transition(id, 'CANCELLED', userId);
    await this.audit.log({
      userId,
      action: 'CANCEL_ORDER',
      entityType: 'ORDER',
      entityId: id,
      detail: `Huỷ đơn ${order.orderCode}`,
    });
    return this.serialize(order);
  }

  /**
   * Chỉnh sửa đơn hàng (cả PENDING lẫn APPROVED).
   * - Đơn APPROVED: Chỉ Admin mới có quyền sửa. Đồng thời cập nhật lại Phiếu nhập & Công nợ liên quan.
   */
  async update(id: string, dto: UpdateOrderDto, user: RequestUser): Promise<PurchaseOrderData> {
    const existing = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy đơn hàng');

    if (existing.status === 'REJECTED' || existing.status === 'CANCELLED') {
      throw new BadRequestException('Không thể chỉnh sửa đơn hàng đã bị từ chối hoặc huỷ');
    }

    if (existing.status === 'APPROVED' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ Admin mới có quyền chỉnh sửa đơn hàng đã duyệt');
    }

    // Snapshot mặt hàng từ danh mục NCC
    const products = await this.prisma.supplierProduct.findMany({
      where: {
        id: { in: dto.items.map((i) => i.productId) },
        supplierId: existing.supplierId,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      if (!productMap.has(item.productId)) {
        throw new BadRequestException(`Mặt hàng ${item.productId} không thuộc nhà cung cấp của đơn hàng này`);
      }
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 1. Xóa các dòng hàng cũ và tạo dòng mới
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      const newItemsData = dto.items.map((i) => {
        const p = productMap.get(i.productId)!;
        return {
          orderId: id,
          productId: p.id,
          name: p.name,
          unit: p.unit,
          unitPrice: p.price,
          quantity: i.quantity,
        };
      });
      await tx.orderItem.createMany({ data: newItemsData });

      // 2. Cập nhật thông tin đơn hàng
      const order = await tx.purchaseOrder.update({
        where: { id },
        data: {
          note: dto.note !== undefined ? dto.note : existing.note,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : existing.expectedDate,
        },
        include: ORDER_INCLUDE,
      });

      const totals = purchaseTotals(
        order.items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
      );

      // 3. Nếu đơn đã APPROVED: Cập nhật lại Phiếu nhập (Receipt) & Công nợ (Payable)
      if (existing.status === 'APPROVED') {
        if (existing.resultReceiptId) {
          await tx.receiptItem.deleteMany({ where: { receiptId: existing.resultReceiptId } });
          await tx.receiptItem.createMany({
            data: order.items.map((i) => ({
              receiptId: existing.resultReceiptId!,
              itemName: i.name,
              unit: i.unit,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          });
        }

        if (existing.resultPayableId) {
          await tx.payable.update({
            where: { id: existing.resultPayableId },
            data: { totalAmount: totals.grandTotal },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE_ORDER',
          entityType: 'ORDER',
          entityId: id,
          detail: `Chỉnh sửa đơn ${existing.orderCode} (${existing.status}) -> ${dto.items.length} dòng, tổng tiền mới: ${totals.grandTotal.toLocaleString('vi-VN')}đ`,
        },
      });

      return order;
    });

    return this.serialize(updatedOrder);
  }

  // ---- Helpers ----

  private async transition(
    id: string,
    to: 'REJECTED' | 'CANCELLED',
    userId: string,
    reason?: string,
  ): Promise<OrderRow> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
      const order = await tx.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

      if (order.status !== 'PENDING') {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (user?.role === 'ADMIN' && to === 'CANCELLED' && order.status === 'APPROVED') {
          // Admin được phép huỷ đơn đã duyệt
        } else {
          throw new ConflictException(`Đơn hàng đã được duyệt, chỉ Admin mới có quyền huỷ/xóa hoặc chỉnh sửa!`);
        }
      }
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: to,
          reviewedBy: userId,
          reviewedAt: new Date(),
          ...(reason ? { rejectReason: reason } : {}),
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  private async serialize(order: OrderRow): Promise<PurchaseOrderData> {
    const creator = await this.prisma.user.findUnique({
      where: { id: order.createdBy },
      select: { name: true },
    });

    let resultReceiptCode: string | null = null;
    let resultPayableCode: string | null = null;
    if (order.resultReceiptId) {
      const receipt = await this.prisma.purchaseReceipt.findUnique({
        where: { id: order.resultReceiptId },
        select: { receiptCode: true },
      });
      resultReceiptCode = receipt?.receiptCode ?? null;
    }
    if (order.resultPayableId) {
      const payable = await this.prisma.payable.findUnique({
        where: { id: order.resultPayableId },
        select: { invoiceCode: true },
      });
      resultPayableCode = payable?.invoiceCode ?? null;
    }

    const items = order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      unit: i.unit,
      unitPrice: Number(i.unitPrice),
      quantity: Number(i.quantity),
    }));
    return {
      id: order.id,
      orderCode: order.orderCode,
      supplierId: order.supplierId,
      supplierName: order.supplier.name,
      facilityId: order.facilityId,
      facilityName: order.facility.name,
      status: order.status,
      note: order.note,
      expectedDate: order.expectedDate?.toISOString() ?? null,
      createdBy: order.createdBy,
      createdByName: creator?.name ?? null,
      reviewedBy: order.reviewedBy,
      reviewedAt: order.reviewedAt?.toISOString() ?? null,
      rejectReason: order.rejectReason,
      resultReceiptId: order.resultReceiptId,
      resultReceiptCode,
      resultPayableId: order.resultPayableId,
      resultPayableCode,
      createdAt: order.createdAt.toISOString(),
      items,
      total: items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
    };
  }
}
