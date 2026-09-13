import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PurchaseOrderData, ReceiveOrderResult } from '@debtflow/shared';
import { RequestUser } from '../auth/jwt.constants';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { invoiceBalance, purchaseTotals } from '../domain';
import { nextOrderCode, nextReceiptCode } from '../common/codes';
import { PayOrderDto, CreateOrderDto, RejectOrderDto, UpdateOrderDto } from './dto/order.dto';

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
        deletedAt: null,
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(orders.map((o) => this.serialize(o)));
  }

  async findOne(id: string, user?: RequestUser): Promise<PurchaseOrderData> {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    // Nhân viên xem được chi tiết mọi đơn (read-only); giá được ẩn ở giao diện.
    // Đơn đã duyệt: staff chỉ xem, không sửa/huỷ/duyệt (chặn ở update/transition).
    return this.serialize(order);
  }

  /** Số đơn PENDING — badge sidebar admin. */
  async pendingCount(): Promise<{ count: number }> {
    const count = await this.prisma.purchaseOrder.count({ where: { status: 'PENDING', deletedAt: null } });
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
   * DUYỆT ĐƠN: PENDING → APPROVED. KHÔNG sinh phiếu nhập/công nợ ở bước này nữa
   * (công nợ chỉ phát sinh khi "Đã nhận hàng"). Chỉ đổi trạng thái + lưu vết.
   */
  async approve(id: string, approverId: string): Promise<PurchaseOrderData> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
      const order = await tx.purchaseOrder.findUnique({ where: { id }, select: { status: true, orderCode: true } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (order.status !== 'PENDING') {
        throw new ConflictException(`Chỉ duyệt được đơn PENDING (hiện tại: ${order.status})`);
      }

      const result = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'APPROVED', reviewedBy: approverId, reviewedAt: new Date() },
        include: ORDER_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          userId: approverId,
          action: 'APPROVE_ORDER',
          entityType: 'ORDER',
          entityId: id,
          detail: `Duyệt đơn ${order.orderCode}`,
        },
      });
      return result;
    });
    return this.serialize(updated);
  }

  /**
   * NHẬN HÀNG — TRỌN VẸN TRONG 1 TRANSACTION:
   * khoá dòng → kiểm APPROVED → sinh Receipt(CONFIRMED) → sinh Payable (công nợ)
   * → cập nhật order (RECEIVED) → ghi audit. Lỗi bất kỳ ⇒ rollback toàn bộ.
   */
  async receive(id: string, receiverId: string, customDueDate?: string): Promise<ReceiveOrderResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Khoá dòng chống nhận hàng đồng thời.
        await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;

        const order = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
        if (order.status !== 'APPROVED') {
          throw new ConflictException(`Chỉ nhận hàng được đơn ĐÃ DUYỆT (hiện tại: ${order.status})`);
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
            createdBy: receiverId,
            confirmedBy: receiverId,
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
            createdBy: receiverId,
          },
        });

        const updated = await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: 'RECEIVED',
            receivedBy: receiverId,
            receivedAt: now,
            resultReceiptId: receipt.id,
            resultPayableId: payable.id,
          },
          include: ORDER_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            userId: receiverId,
            action: 'RECEIVE_ORDER',
            entityType: 'ORDER',
            entityId: id,
            detail: `Nhận hàng đơn ${order.orderCode} → phiếu nhập ${receiptCode} + công nợ ${totals.grandTotal.toLocaleString('vi-VN')}đ`,
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

  /**
   * THANH TOÁN TRỌN CẢ ĐƠN: RECEIVED → PAID.
   * Sinh 1 khoản chi = số dư công nợ còn lại → công nợ về 0 (rời danh sách còn nợ).
   */
  async pay(id: string, payerId: string, input?: PayOrderDto): Promise<PurchaseOrderData> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
      const order = await tx.purchaseOrder.findUnique({
        where: { id },
        select: { status: true, orderCode: true, resultPayableId: true },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (order.status !== 'RECEIVED') {
        throw new ConflictException(`Chỉ thanh toán được đơn ĐÃ NHẬN HÀNG (hiện tại: ${order.status})`);
      }
      if (!order.resultPayableId) {
        throw new ConflictException('Đơn chưa có công nợ để thanh toán');
      }

      const payable = await tx.payable.findUnique({
        where: { id: order.resultPayableId },
        include: { payments: true },
      });
      if (!payable) throw new NotFoundException('Không tìm thấy công nợ của đơn');

      const balance = invoiceBalance(
        Number(payable.totalAmount),
        payable.payments.map((p) => ({ amount: Number(p.amount), status: p.status })),
      );

      const now = new Date();
      if (balance > 0) {
        await tx.payment.create({
          data: {
            direction: 'PAYABLE',
            payableId: payable.id,
            amount: balance,
            paymentDate: input?.paymentDate ? new Date(input.paymentDate) : now,
            paymentMethod: input?.paymentMethod ?? null,
            transactionCode: input?.transactionCode ?? null,
            proofUrl: input?.proofUrl ?? null,
            note: input?.note ?? `Thanh toán trọn đơn ${order.orderCode}`,
            createdBy: payerId,
          },
        });
      }

      const result = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'PAID', paidBy: payerId, paidAt: now },
        include: ORDER_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          userId: payerId,
          action: 'PAY_ORDER',
          entityType: 'ORDER',
          entityId: id,
          detail: `Thanh toán trọn đơn ${order.orderCode}: ${balance.toLocaleString('vi-VN')}đ`,
        },
      });
      return result;
    });
    return this.serialize(updated);
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
    if (existing.status === 'PAID') {
      throw new BadRequestException('Đơn đã thanh toán — không thể chỉnh sửa');
    }

    const isAdmin = user.role === 'ADMIN';
    if ((existing.status === 'APPROVED' || existing.status === 'RECEIVED') && !isAdmin) {
      throw new ForbiddenException('Chỉ Admin mới có quyền chỉnh sửa đơn hàng đã duyệt/đã nhận hàng');
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

    // Đơn giá mỗi dòng: Admin truyền unitPrice ⇒ dùng giá mới (đồng thời ghi đè danh mục NCC);
    // ngược lại snapshot giá hiện tại trong danh mục.
    const resolvedItems = dto.items.map((i) => {
      const p = productMap.get(i.productId)!;
      const override = isAdmin && i.unitPrice !== undefined && i.unitPrice !== null;
      return {
        product: p,
        name: p.name,
        unit: p.unit,
        unitPrice: override ? Number(i.unitPrice) : Number(p.price),
        quantity: i.quantity,
        override,
      };
    });

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 0. Admin sửa giá ⇒ ghi đè giá trong danh mục NCC (đơn mới sau này lấy giá mới).
      for (const it of resolvedItems) {
        if (it.override && Number(it.product.price) !== it.unitPrice) {
          await tx.supplierProduct.update({
            where: { id: it.product.id },
            data: { price: it.unitPrice },
          });
          await tx.supplierProductPriceHistory.create({
            data: {
              supplierProductId: it.product.id,
              oldPrice: it.product.price,
              newPrice: it.unitPrice,
              source: 'ORDER_EDIT',
              changedBy: user.id,
            },
          });
        }
      }

      // 1. Xóa các dòng hàng cũ và tạo dòng mới
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({
        data: resolvedItems.map((it) => ({
          orderId: id,
          productId: it.product.id,
          name: it.name,
          unit: it.unit,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        })),
      });

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

      // 3. Nếu đơn đã có phiếu nhập + công nợ (RECEIVED, hoặc dữ liệu cũ) → resync theo giá/số lượng mới.
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

  /**
   * XÓA ĐƠN (soft-delete) — CHỈ ADMIN.
   * Đánh dấu deletedAt/deletedBy cho đơn + phiếu nhập + công nợ liên kết (nếu có)
   * ⇒ biến mất khỏi danh sách, báo cáo/thống kê, công nợ. Không xóa cứng.
   */
  async remove(id: string, user: RequestUser): Promise<{ id: string }> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ Admin mới có quyền xóa đơn hàng');
    }

    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
      const now = new Date();

      await tx.purchaseOrder.update({
        where: { id },
        data: { deletedAt: now, deletedBy: user.id },
      });

      if (order.resultReceiptId) {
        await tx.purchaseReceipt.update({
          where: { id: order.resultReceiptId },
          data: { deletedAt: now, deletedBy: user.id },
        });
      }
      if (order.resultPayableId) {
        await tx.payable.update({
          where: { id: order.resultPayableId },
          data: { deletedAt: now, deletedBy: user.id },
        });
      }

      const total = purchaseTotals(
        order.items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
      ).grandTotal;
      const linked = [
        order.resultReceiptId ? 'phiếu nhập' : null,
        order.resultPayableId ? 'công nợ' : null,
      ].filter(Boolean);

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE_ORDER',
          entityType: 'ORDER',
          entityId: id,
          detail: `Xóa đơn ${order.orderCode} (${order.status}), tổng ${total.toLocaleString('vi-VN')}đ${
            linked.length ? ` — kèm ${linked.join(' + ')}` : ''
          }`,
        },
      });
    });

    return { id };
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
      receivedAt: order.receivedAt?.toISOString() ?? null,
      paidAt: order.paidAt?.toISOString() ?? null,
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
