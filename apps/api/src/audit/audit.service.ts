import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditLogEntry, Paginated } from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditFilter {
  page: number;
  pageSize: number;
  action?: string;
  entityType?: string;
  userId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
}

/** Ghi AuditLog (append-only) — mọi thao tác thay đổi đều gọi qua đây. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    detail?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        detail: params.detail ?? null,
      },
    });
  }

  /** Nhật ký toàn hệ thống — phân trang server-side, mới nhất trước. */
  async findAll(filter: AuditFilter): Promise<Paginated<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      action: filter.action || undefined,
      entityType: filter.entityType || undefined,
      userId: filter.userId || undefined,
      time:
        filter.from || filter.to
          ? {
              gte: filter.from ? new Date(`${filter.from}T00:00:00.000Z`) : undefined,
              lt: filter.to
                ? new Date(new Date(`${filter.to}T00:00:00.000Z`).getTime() + 86400000)
                : undefined,
            }
          : undefined,
    };

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { time: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);

    // userId là chuỗi tự do (không FK) — join tên user thủ công.
    const userIds = [...new Set(logs.map((l) => l.userId).filter((x): x is string => !!x))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.name]));

    return {
      data: logs.map((l) => ({
        id: l.id,
        time: l.time.toISOString(),
        userId: l.userId,
        userName: l.userId ? (nameMap.get(l.userId) ?? null) : null,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        detail: l.detail,
      })),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }
}
