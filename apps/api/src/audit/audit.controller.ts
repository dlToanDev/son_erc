import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { AuditService } from './audit.service';

const MAX_PAGE_SIZE = 100;

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit', 'view')
  findAll(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || 20));
    for (const d of [from, to]) {
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        throw new BadRequestException('from/to phải theo định dạng YYYY-MM-DD');
      }
    }
    return this.audit.findAll({ page: p, pageSize: size, action, entityType, userId, from, to });
  }
}
