import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { PERMISSION_KEY } from '../auth/decorators/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../auth/jwt.constants';

/**
 * In đơn gửi NCC phải bị chặn Ở SERVER, không chỉ ẩn nút trên giao diện:
 * endpoint khai báo @RequirePermission('orders','print') và PermissionGuard
 * từ chối nhân viên chưa được cấp quyền.
 */
describe('OrdersController — in đơn gửi NCC', () => {
  const reflector = new Reflector();

  it('endpoint in khai báo quyền orders.print', () => {
    const required = reflector.get(PERMISSION_KEY, OrdersController.prototype.print);

    expect(required).toEqual({ module: 'orders', action: 'print' });
  });

  it('gọi service với id đơn và id người in (để ghi audit)', async () => {
    const getPrintData = jest.fn().mockResolvedValue({ orderCode: 'DH-2026-001' });
    const controller = new OrdersController({ getPrintData } as unknown as OrdersService);

    await controller.print('ord-1', { id: 'usr-admin' } as RequestUser);

    expect(getPrintData).toHaveBeenCalledWith('ord-1', 'usr-admin');
  });

  describe('PermissionGuard với quyền orders.print', () => {
    const contextFor = (user: Partial<RequestUser>) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
        getHandler: () => OrdersController.prototype.print,
        getClass: () => OrdersController,
      }) as unknown as ExecutionContext;

    const guardWith = (permission: unknown) =>
      new PermissionGuard(reflector, {
        staffPermission: { findUnique: jest.fn().mockResolvedValue(permission) },
      } as unknown as PrismaService);

    it('ADMIN luôn in được', async () => {
      const guard = guardWith(null);

      await expect(guard.canActivate(contextFor({ id: 'u1', role: 'ADMIN' }))).resolves.toBe(
        true,
      );
    });

    it('STAFF được cấp quyền print → in được', async () => {
      const guard = guardWith({ allowed: true });

      await expect(guard.canActivate(contextFor({ id: 'u2', role: 'STAFF' }))).resolves.toBe(
        true,
      );
    });

    it('STAFF chưa được cấp quyền print → ForbiddenException', async () => {
      const guard = guardWith(null);

      await expect(guard.canActivate(contextFor({ id: 'u3', role: 'STAFF' }))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('STAFF bị tắt quyền print (allowed=false) → ForbiddenException', async () => {
      const guard = guardWith({ allowed: false });

      await expect(guard.canActivate(contextFor({ id: 'u4', role: 'STAFF' }))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
