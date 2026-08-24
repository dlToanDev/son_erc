import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';
import type { RequestUser } from '../jwt.constants';

/**
 * Kiểm tra PermissionSet phía server (module → action):
 * - ADMIN: toàn quyền.
 * - STAFF: phải có dòng staff_permissions allowed=true.
 * Endpoint không khai báo @RequirePermission thì chỉ cần đăng nhập.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const user = context.switchToHttp().getRequest().user as RequestUser | undefined;
    if (!user) throw new ForbiddenException('Không xác định được người dùng');

    if (user.role === 'ADMIN') return true;

    const permission = await this.prisma.staffPermission.findUnique({
      where: {
        userId_module_action: {
          userId: user.id,
          module: required.module,
          action: required.action,
        },
      },
    });

    if (!permission?.allowed) {
      throw new ForbiddenException(
        `Không có quyền ${required.action} trên ${required.module}`,
      );
    }
    return true;
  }
}
