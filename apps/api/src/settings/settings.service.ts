import { Injectable } from '@nestjs/common';
import type { SettingsData } from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateSettingsDto } from './dto/settings.dto';

const DEFAULTS: SettingsData = {
  warningDays: 7,
  criticalWarningDays: 3,
  currency: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Singleton id=1 — tự tạo với default nếu chưa có. */
  async get(): Promise<SettingsData> {
    const row = await this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...DEFAULTS },
      update: {},
    });
    const { id: _id, ...data } = row;
    return data;
  }

  async update(dto: UpdateSettingsDto, userId: string): Promise<SettingsData> {
    await this.get(); // đảm bảo tồn tại
    const row = await this.prisma.settings.update({ where: { id: 1 }, data: dto });
    await this.audit.log({
      userId,
      action: 'UPDATE_SETTINGS',
      entityType: 'SETTINGS',
      entityId: '1',
      detail: `Cập nhật cấu hình: ${JSON.stringify(dto)}`,
    });
    const { id: _id, ...data } = row;
    return data;
  }
}
