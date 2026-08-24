import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { RangeValue } from '@debtflow/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Dashboard: 4 KPI + series + so sánh cơ sở + cảnh báo. */
  @Get('dashboard')
  @RequirePermission('dashboard', 'view')
  dashboard(@Query('range') range = '1m', @Query('facilityId') facilityId?: string) {
    return this.reports.dashboard(range as RangeValue, facilityId);
  }

  /** Badge sidebar: đếm cảnh báo công nợ. */
  @Get('debt-alerts')
  @RequirePermission('dashboard', 'view')
  debtAlerts() {
    return this.reports.debtAlertCounts();
  }

  /** Thống kê sản lượng/chi phí theo cơ sở & kỳ. */
  @Get('stats')
  @RequirePermission('reports', 'view')
  stats(
    @Query('range') range = '1m',
    @Query('facilityId') facilityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.stats(range as RangeValue, facilityId, from, to);
  }

  /** So sánh chi phí nhập 2 kỳ. */
  @Get('compare')
  @RequirePermission('reports', 'view')
  compare(
    @Query('fromA') fromA: string,
    @Query('toA') toA: string,
    @Query('fromB') fromB: string,
    @Query('toB') toB: string,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.reports.compare(fromA, toA, fromB, toB, facilityId);
  }
}
