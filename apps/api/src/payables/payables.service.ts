import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PayableData, PayableDetail, PaymentData } from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { invoiceBalance, invoiceStatus } from '../domain';

const PAYABLE_INCLUDE = {
  supplier: { select: { name: true } },
  receipt: {
    select: {
      receiptCode: true,
      items: true,
    },
  },
  payments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PayableInclude;

type PayableRow = Prisma.PayableGetPayload<{ include: typeof PAYABLE_INCLUDE }>;

@Injectable()
export class PayablesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Danh sách công nợ — balance & status TÍNH RUNTIME (không lưu cứng). */
  async findAll(filter: { supplierId?: string; status?: string }): Promise<PayableData[]> {
    const payables = await this.prisma.payable.findMany({
      where: { supplierId: filter.supplierId || undefined },
      include: PAYABLE_INCLUDE,
      orderBy: { invoiceDate: 'desc' },
    });
    const list = payables.map((p) => this.serialize(p));
    // Lọc theo trạng thái runtime sau khi tính.
    return filter.status ? list.filter((p) => p.status === filter.status) : list;
  }

  async findOne(id: string): Promise<PayableDetail> {
    const payable = await this.prisma.payable.findUnique({
      where: { id },
      include: PAYABLE_INCLUDE,
    });
    if (!payable) throw new NotFoundException('Không tìm thấy công nợ');
    return {
      ...this.serialize(payable),
      payments: payable.payments.map((pm) =>
        this.serializePayment(pm, payable.invoiceCode, payable.supplier.name),
      ),
    };
  }

  serialize(p: PayableRow): PayableData {
    const total = Number(p.totalAmount);
    const payments = p.payments.map((pm) => ({ amount: Number(pm.amount), status: pm.status }));
    const balance = invoiceBalance(total, payments);
    // Không có dueDate → không bao giờ OVERDUE (so theo ngày hôm nay).
    const status = p.dueDate
      ? invoiceStatus(total, payments, p.dueDate)
      : invoiceStatus(total, payments, '9999-12-31');

    const items = p.receipt?.items.map((i) => ({
      id: i.id,
      itemName: i.itemName,
      unit: i.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      note: i.note,
    })) ?? [];

    return {
      id: p.id,
      invoiceCode: p.invoiceCode,
      supplierId: p.supplierId,
      supplierName: p.supplier.name,
      purchaseReceiptId: p.purchaseReceiptId,
      receiptCode: p.receipt?.receiptCode ?? null,
      invoiceDate: p.invoiceDate.toISOString(),
      dueDate: p.dueDate?.toISOString() ?? null,
      totalAmount: total,
      paid: total - balance,
      balance,
      status,
      description: p.description,
      note: p.note,
      createdAt: p.createdAt.toISOString(),
      items,
    };
  }

  serializePayment(
    pm: PayableRow['payments'][number],
    invoiceCode: string,
    supplierName: string,
  ): PaymentData {
    return {
      id: pm.id,
      payableId: pm.payableId,
      invoiceCode,
      supplierName,
      amount: Number(pm.amount),
      paymentDate: pm.paymentDate.toISOString(),
      paymentMethod: pm.paymentMethod,
      transactionCode: pm.transactionCode,
      proofUrl: pm.proofUrl,
      note: pm.note,
      status: pm.status,
      createdBy: pm.createdBy,
      createdAt: pm.createdAt.toISOString(),
      cancelledBy: pm.cancelledBy,
      cancelledAt: pm.cancelledAt?.toISOString() ?? null,
    };
  }
}
