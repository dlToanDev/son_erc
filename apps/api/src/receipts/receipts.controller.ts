import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.constants';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/receipt.dto';

@Controller('receipts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get()
  @RequirePermission('receipts', 'view')
  findAll(
    @Query('supplierId') supplierId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('status') status?: string,
  ) {
    return this.receipts.findAll({ supplierId, facilityId, status });
  }

  @Get(':id')
  @RequirePermission('receipts', 'view')
  findOne(@Param('id') id: string) {
    return this.receipts.findOne(id);
  }

  @Post()
  @RequirePermission('receipts', 'edit')
  create(@Body() dto: CreateReceiptDto, @CurrentUser() user: RequestUser) {
    return this.receipts.create(dto, user.id);
  }

  @Post(':id/confirm')
  @RequirePermission('receipts', 'edit')
  confirm(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.receipts.confirm(id, user.id);
  }
}
