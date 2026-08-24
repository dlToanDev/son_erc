import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { PayablesService } from './payables.service';

@Controller('payables')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PayablesController {
  constructor(private readonly payables: PayablesService) {}

  @Get()
  @RequirePermission('payables', 'view')
  findAll(@Query('supplierId') supplierId?: string, @Query('status') status?: string) {
    return this.payables.findAll({ supplierId, status });
  }

  @Get(':id')
  @RequirePermission('payables', 'view')
  findOne(@Param('id') id: string) {
    return this.payables.findOne(id);
  }
}
