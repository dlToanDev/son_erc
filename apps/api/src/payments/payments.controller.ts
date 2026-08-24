import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.constants';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermission('payments', 'view')
  findAll(@Query('payableId') payableId?: string, @Query('supplierId') supplierId?: string) {
    return this.payments.findAll({ payableId, supplierId });
  }

  @Post()
  @RequirePermission('payables', 'pay')
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: RequestUser) {
    return this.payments.create(dto, user.id);
  }

  /** Void = soft-void, ai có quyền thanh toán thì được huỷ giao dịch. */
  @Post(':id/void')
  @RequirePermission('payables', 'pay')
  void(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.payments.void(id, user.id);
  }
}
