import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dữ liệu in đơn gửi NCC — chỉ đơn đã duyệt trở đi mới được in,
 * và bản in phải đủ thông tin liên hệ để gửi ra ngoài.
 */
describe('OrdersService.getPrintData', () => {
  const makeOrder = (overrides: Record<string, unknown> = {}) => ({
    id: 'ord-1',
    orderCode: 'DH-2026-001',
    status: 'APPROVED',
    note: 'Giao buổi sáng',
    expectedDate: new Date('2026-09-20T00:00:00.000Z'),
    createdBy: 'usr-1',
    createdAt: new Date('2026-09-14T00:00:00.000Z'),
    reviewedAt: new Date('2026-09-15T00:00:00.000Z'),
    supplierId: 'sup-1',
    facilityId: 'fac-1',
    supplier: {
      name: 'Công ty TNHH ABC',
      address: '123 Lê Lợi, Q1, TP.HCM',
      phone: '0909123456',
      taxCode: '0301234567',
      contactPerson: 'Chị Lan',
    },
    facility: { name: 'Cơ sở 1', address: '45 Nguyễn Huệ, Q1' },
    items: [
      { id: 'it-1', name: 'Rau cải', unit: 'kg', quantity: 12.5, unitPrice: 20000 },
      { id: 'it-2', name: 'Đậu hũ', unit: 'kg', quantity: 8, unitPrice: 35000 },
    ],
    ...overrides,
  });

  const makeDeps = (order: unknown) => {
    const prisma = {
      purchaseOrder: { findFirst: jest.fn().mockResolvedValue(order) },
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Quản trị viên' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    return { prisma, audit: new AuditService(prisma) };
  };

  it('đơn APPROVED → trả đủ thông tin liên hệ NCC và địa chỉ cơ sở nhận hàng', async () => {
    const { prisma, audit } = makeDeps(makeOrder());
    const service = new OrdersService(prisma, audit);

    const result = await service.getPrintData('ord-1', 'usr-admin');

    expect(result.orderCode).toBe('DH-2026-001');
    expect(result.supplier).toEqual({
      name: 'Công ty TNHH ABC',
      address: '123 Lê Lợi, Q1, TP.HCM',
      phone: '0909123456',
      taxCode: '0301234567',
      contactPerson: 'Chị Lan',
    });
    expect(result.facility).toEqual({ name: 'Cơ sở 1', address: '45 Nguyễn Huệ, Q1' });
  });

  it('tính thành tiền từng dòng và tổng cộng', async () => {
    const { prisma, audit } = makeDeps(makeOrder());
    const service = new OrdersService(prisma, audit);

    const result = await service.getPrintData('ord-1', 'usr-admin');

    expect(result.items.map((i) => i.lineTotal)).toEqual([250000, 280000]);
    expect(result.total).toBe(530000);
  });

  it.each(['PENDING', 'REJECTED', 'CANCELLED'])(
    'đơn %s → BadRequestException (chưa duyệt thì không gửi NCC)',
    async (status) => {
      const { prisma, audit } = makeDeps(makeOrder({ status }));
      const service = new OrdersService(prisma, audit);

      await expect(service.getPrintData('ord-1', 'usr-admin')).rejects.toThrow(
        BadRequestException,
      );
    },
  );

  it.each(['APPROVED', 'RECEIVED', 'PAID'])('đơn %s → in được', async (status) => {
    const { prisma, audit } = makeDeps(makeOrder({ status }));
    const service = new OrdersService(prisma, audit);

    await expect(service.getPrintData('ord-1', 'usr-admin')).resolves.toBeTruthy();
  });

  it('đơn không tồn tại (hoặc đã xoá) → NotFoundException', async () => {
    const { prisma, audit } = makeDeps(null);
    const service = new OrdersService(prisma, audit);

    await expect(service.getPrintData('ord-404', 'usr-admin')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('ghi audit PRINT_ORDER để truy vết đơn đã gửi ra ngoài', async () => {
    const { prisma, audit } = makeDeps(makeOrder());
    const service = new OrdersService(prisma, audit);

    await service.getPrintData('ord-1', 'usr-admin');

    const logged = (prisma.auditLog.create as unknown as jest.Mock).mock.calls[0][0].data;
    expect(logged.action).toBe('PRINT_ORDER');
    expect(logged.userId).toBe('usr-admin');
    expect(logged.entityId).toBe('ord-1');
  });

  it('không in đơn đã soft-delete (query phải lọc deletedAt)', async () => {
    const { prisma, audit } = makeDeps(makeOrder());
    const service = new OrdersService(prisma, audit);

    await service.getPrintData('ord-1', 'usr-admin');

    const where = (prisma.purchaseOrder.findFirst as unknown as jest.Mock).mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'ord-1', deletedAt: null });
  });
});
