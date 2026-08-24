import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.constants';
import { SettingsService } from './settings.service';
import { BackupService } from '../backup/backup.service';
import { UpdateSettingsDto } from './dto/settings.dto';
import { RestoreLatestDto } from './dto/restore.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly backup: BackupService,
  ) {}

  /** Mọi user đăng nhập đọc được (FE cần warningDays cho badge cảnh báo). */
  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  @RequirePermission('settings', 'edit')
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: RequestUser) {
    return this.settings.update(dto, user.id);
  }

  /** Bản backup gần nhất (để FE hiển thị mốc sẽ khôi phục về). */
  @Get('latest-backup')
  latestBackup() {
    return this.backup.getLatest();
  }

  /** Khôi phục DB về bản backup gần nhất — GHI ĐÈ toàn bộ. Chỉ Admin. */
  @Post('restore-latest')
  @RequirePermission('settings', 'edit')
  restoreLatest(@Body() dto: RestoreLatestDto, @CurrentUser() user: RequestUser) {
    return this.backup.restoreLatest(user.id, dto.confirm);
  }
}
