import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaymentData } from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { invoiceBalance } from '../domain';
import { CreatePaymentDto } from './dto/payment.dto';

const PAYMENT_INCLUDE = {
  payable: { select: { invoiceCode: true, supplier: { select: { name: true } } } },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lịch sử thanh toán (kể cả đã void). */
  async findAll(filter: { payableId?: string; supplierId?: string }): Promise<PaymentData[]> {
    const payments = await this.prisma.payment.findMany({
      where: {
        payableId: filter.payableId || undefined,
        payable: filter.supplierId ? { supplierId: filter.supplierId } : undefined,
      },
      include: PAYMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.serialize(p));
  }

  /**
   * Tạo thanh toán — 1 TRANSACTION: khoá payable → tính số dư runtime
   * → CHẶN TRẢ VƯỢT SỐ DƯ → tạo payment ACTIVE → audit.
   */
  async create(dto: CreatePaymentDto, userId: string): Promise<PaymentData> {
    const payment = await this.prisma.$transaction(async (tx) => {
      // Khoá payable chống 2 thanh toán đồng thời vượt số dư.
      await tx.$queryRaw`SELECT id FROM payables WHERE id = ${dto.payableId} FOR UPDATE`;

      const payable = await tx.payable.findUnique({
        where: { id: dto.payableId },
        include: { payments: { select: { amount: true, status: true } } },
      });
      if (!payable) throw new NotFoundException('Không tìm thấy công nợ');

      const balance = invoiceBalance(
        Number(payable.totalAmount),
        payable.payments.map((p) => ({ amount: Number(p.amount), status: p.status })),
      );
      if (dto.amount > balance + 1e-9) {
        throw new BadRequestException(
          `Số tiền vượt số dư còn lại (${balance.toLocaleString('vi-VN')}đ)`,
        );
      }

      const created = await tx.payment.create({
        data: {
          payableId: dto.payableId,
          amount: dto.amount,
          paymentDate: new Date(dto.paymentDate),
          paymentMethod: dto.paymentMethod,
          transactionCode: dto.transactionCode,
          proofUrl: dto.proofUrl,
          note: dto.note,
          createdBy: userId,
        },
        include: PAYMENT_INCLUDE,
      });

      if (dto.nextDueDate) {
        await tx.payable.update({
          where: { id: dto.payableId },
          data: { dueDate: new Date(dto.nextDueDate) },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_PAYMENT',
          entityType: 'PAYMENT',
          entityId: created.id,
          detail: `Thanh toán ${dto.amount.toLocaleString('vi-VN')}đ cho ${payable.invoiceCode}${dto.nextDueDate ? ` (Hẹn trả tiếp: ${dto.nextDueDate})` : ''}`,
        },
      });
      return created;
    });

    return this.serialize(payment);
  }

  /**
   * VOID — soft-void (KHÔNG xoá cứng): ACTIVE → CANCELLED
   * → số dư công nợ tự hoàn lại (vì balance tính runtime chỉ đếm ACTIVE) → audit.
   */
  async void(id: string, userId: string): Promise<PaymentData> {
    const payment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id} FOR UPDATE`;

      const existing = await tx.payment.findUnique({
        where: { id },
        include: PAYMENT_INCLUDE,
      });
      if (!existing) throw new NotFoundException('Không tìm thấy giao dịch');
      if (existing.status !== 'ACTIVE') {
        throw new ConflictException('Giao dịch đã bị huỷ trước đó');
      }

      const updated = await tx.payment.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledBy: userId, cancelledAt: new Date() },
        include: PAYMENT_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'VOID_PAYMENT',
          entityType: 'PAYMENT',
          entityId: id,
          detail: `Huỷ (void) thanh toán ${Number(existing.amount).toLocaleString('vi-VN')}đ của ${existing.payable.invoiceCode} — hoàn số dư`,
        },
      });
      return updated;
    });

    return this.serialize(payment);
  }

  private serialize(p: PaymentRow): PaymentData {
    return {
      id: p.id,
      payableId: p.payableId,
      invoiceCode: p.payable.invoiceCode,
      supplierName: p.payable.supplier.name,
      amount: Number(p.amount),
      paymentDate: p.paymentDate.toISOString(),
      paymentMethod: p.paymentMethod,
      transactionCode: p.transactionCode,
      proofUrl: p.proofUrl,
      note: p.note,
      status: p.status,
      createdBy: p.createdBy,
      createdAt: p.createdAt.toISOString(),
      cancelledBy: p.cancelledBy,
      cancelledAt: p.cancelledAt?.toISOString() ?? null,
    };
  }
}
