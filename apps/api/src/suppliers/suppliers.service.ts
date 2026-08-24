import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Supplier, SupplierProduct, SupplierWithTotals } from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { invoiceBalance, invoiceStatus } from '../domain';
import {
  CreateProductDto,
  CreateSupplierDto,
  UpdateProductDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';

type PayableWithPayments = {
  totalAmount: Prisma.Decimal;
  dueDate: Date | null;
  payments: { amount: Prisma.Decimal; status: 'ACTIVE' | 'CANCELLED' }[];
};

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** List NCC kèm tổng phát sinh / còn nợ / quá hạn — tính runtime từ domain. */
  async findAll(search?: string): Promise<SupplierWithTotals[]> {
    const suppliers = await this.prisma.supplier.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      include: {
        payables: { include: { payments: { select: { amount: true, status: true } } } },
      },
      orderBy: { code: 'asc' },
    });

    return suppliers.map(({ payables, ...supplier }) => ({
      ...supplier,
      ...this.computeTotals(payables),
    }));
  }

  async findOne(id: string): Promise<SupplierWithTotals> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        payables: { include: { payments: { select: { amount: true, status: true } } } },
      },
    });
    if (!supplier) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    const { payables, ...rest } = supplier;
    return { ...rest, ...this.computeTotals(payables) };
  }

  async create(dto: CreateSupplierDto, userId: string): Promise<Supplier> {
    try {
      const supplier = await this.prisma.supplier.create({ data: dto });
      await this.audit.log({
        userId,
        action: 'CREATE_SUPPLIER',
        entityType: 'SUPPLIER',
        entityId: supplier.id,
        detail: `Tạo NCC ${supplier.code} — ${supplier.name}`,
      });
      return supplier;
    } catch (e) {
      this.rethrowUnique(e, dto.code);
    }
  }

  async update(id: string, dto: UpdateSupplierDto, userId: string): Promise<Supplier> {
    const existing = await this.prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    try {
      const supplier = await this.prisma.supplier.update({ where: { id }, data: dto });
      await this.audit.log({
        userId,
        action: 'UPDATE_SUPPLIER',
        entityType: 'SUPPLIER',
        entityId: id,
        detail: `Cập nhật NCC ${supplier.code}`,
      });
      return supplier;
    } catch (e) {
      this.rethrowUnique(e, dto.code ?? existing.code);
    }
  }

  // ---- Products ----

  async findProducts(supplierId: string): Promise<SupplierProduct[]> {
    await this.ensureSupplier(supplierId);
    const products = await this.prisma.supplierProduct.findMany({
      where: { supplierId },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => ({ ...p, price: Number(p.price) }));
  }

  async createProduct(
    supplierId: string,
    dto: CreateProductDto,
    userId: string,
  ): Promise<SupplierProduct> {
    await this.ensureSupplier(supplierId);
    const product = await this.prisma.supplierProduct.create({
      data: { ...dto, supplierId },
    });
    await this.audit.log({
      userId,
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: product.id,
      detail: `Thêm mặt hàng "${product.name}" (${product.unit}) cho NCC ${supplierId}`,
    });
    return { ...product, price: Number(product.price) };
  }

  async updateProduct(
    supplierId: string,
    productId: string,
    dto: UpdateProductDto,
    userId: string,
  ): Promise<SupplierProduct> {
    const existing = await this.prisma.supplierProduct.findFirst({
      where: { id: productId, supplierId },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy mặt hàng');

    const product = await this.prisma.supplierProduct.update({
      where: { id: productId },
      data: dto,
    });
    await this.audit.log({
      userId,
      action: 'UPDATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: productId,
      detail: `Cập nhật mặt hàng "${product.name}"`,
    });
    return { ...product, price: Number(product.price) };
  }

  async deleteProduct(
    supplierId: string,
    productId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.prisma.supplierProduct.findFirst({
      where: { id: productId, supplierId },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy mặt hàng');

    await this.prisma.supplierProduct.delete({
      where: { id: productId },
    });
    await this.audit.log({
      userId,
      action: 'DELETE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: productId,
      detail: `Xoá mặt hàng "${existing.name}"`,
    });
    return { success: true };
  }

  // ---- Helpers ----

  private computeTotals(payables: PayableWithPayments[]) {
    let totalInvoiced = 0;
    let balance = 0;
    let overdueCount = 0;
    const today = new Date();

    for (const payable of payables) {
      const total = Number(payable.totalAmount);
      const payments = payable.payments.map((p) => ({
        amount: Number(p.amount),
        status: p.status,
      }));
      totalInvoiced += total;
      balance += invoiceBalance(total, payments);
      if (payable.dueDate && invoiceStatus(total, payments, payable.dueDate, today) === 'OVERDUE') {
        overdueCount += 1;
      }
    }

    return {
      totalInvoiced,
      totalPaid: totalInvoiced - balance,
      balance,
      overdueCount,
    };
  }

  private async ensureSupplier(id: string): Promise<void> {
    const found = await this.prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('Không tìm thấy nhà cung cấp');
  }

  private rethrowUnique(e: unknown, code: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException(`Mã NCC "${code}" đã tồn tại`);
    }
    throw e;
  }
}
