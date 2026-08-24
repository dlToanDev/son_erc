import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { PermissionEntry, UserSummary } from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, SetPermissionsDto, UpdateUserDto } from './dto/user.dto';

// Không bao giờ select passwordHash.
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(): Promise<(UserSummary & { permissions: PermissionEntry[] })[]> {
    const users = await this.prisma.user.findMany({
      select: { ...USER_SELECT, permissions: { select: { module: true, action: true, allowed: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      ...u,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async create(dto: CreateUserDto, actorId: string): Promise<UserSummary> {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash: await bcrypt.hash(dto.password, 10),
          role: dto.role,
          ...(dto.role === 'STAFF'
            ? {
                permissions: {
                  create: [
                    { module: 'orders', action: 'view', allowed: true },
                    { module: 'orders', action: 'edit', allowed: true },
                  ],
                },
              }
            : {}),
        },
        select: USER_SELECT,
      });
      await this.audit.log({
        userId: actorId,
        action: 'CREATE_USER',
        entityType: 'USER',
        entityId: user.id,
        detail: `Tạo user ${user.email} (${user.role})`,
      });
      return this.serialize(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Email "${dto.email}" đã tồn tại`);
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateUserDto, actorId: string): Promise<UserSummary> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Không tìm thấy người dùng');

    // Chặn tự khoá / tự hạ quyền chính mình.
    if (id === actorId && (dto.status === 'INACTIVE' || dto.role === 'STAFF')) {
      throw new ForbiddenException('Không thể tự khoá hoặc tự hạ quyền tài khoản của chính mình');
    }

    const { password, ...rest } = dto;
    const data: Prisma.UserUpdateInput = { ...rest };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.update({ where: { id }, data, select: USER_SELECT });
      await this.audit.log({
        userId: actorId,
        action: 'UPDATE_USER',
        entityType: 'USER',
        entityId: id,
        detail: `Cập nhật user ${user.email}${password ? ' (đổi mật khẩu)' : ''}`,
      });
      return this.serialize(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Email "${dto.email}" đã tồn tại`);
      }
      throw e;
    }
  }

  /** Thay thế trọn bộ PermissionSet trong 1 transaction. */
  async setPermissions(
    id: string,
    dto: SetPermissionsDto,
    actorId: string,
  ): Promise<PermissionEntry[]> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    await this.prisma.$transaction([
      this.prisma.staffPermission.deleteMany({ where: { userId: id } }),
      this.prisma.staffPermission.createMany({
        data: dto.permissions.map((p) => ({ userId: id, ...p })),
      }),
    ]);

    await this.audit.log({
      userId: actorId,
      action: 'SET_PERMISSIONS',
      entityType: 'USER',
      entityId: id,
      detail: `Cập nhật phân quyền cho ${user.email} (${dto.permissions.filter((p) => p.allowed).length} quyền)`,
    });

    return this.prisma.staffPermission.findMany({
      where: { userId: id },
      select: { module: true, action: true, allowed: true },
    });
  }

  private serialize(user: {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'STAFF';
    status: 'ACTIVE' | 'INACTIVE';
    lastLoginAt: Date | null;
    createdAt: Date;
  }): UserSummary {
    return {
      ...user,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
