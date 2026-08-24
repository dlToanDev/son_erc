import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.constants';
import { OrdersService } from './orders.service';
import { ApproveOrderDto, CreateOrderDto, RejectOrderDto, UpdateOrderDto } from './dto/order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermission('orders', 'view')
  findAll(@Query('facilityId') facilityId?: string, @Query('status') status?: string) {
    return this.orders.findAll({ facilityId, status });
  }

  /** Badge sidebar — số đơn chờ duyệt. */
  @Get('pending-count')
  @RequirePermission('orders', 'view')
  pendingCount() {
    return this.orders.pendingCount();
  }

  @Get(':id')
  @RequirePermission('orders', 'view')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.orders.findOne(id, user);
  }

  @Post()
  @RequirePermission('orders', 'edit')
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: RequestUser) {
    return this.orders.create(dto, user.id);
  }

  @Post(':id/approve')
  @RequirePermission('orders', 'approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.orders.approve(id, user.id, dto?.dueDate);
  }

  @Post(':id/reject')
  @RequirePermission('orders', 'approve')
  reject(@Param('id') id: string, @Body() dto: RejectOrderDto, @CurrentUser() user: RequestUser) {
    return this.orders.reject(id, dto, user.id);
  }

  @Post(':id/cancel')
  @RequirePermission('orders', 'edit')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.orders.cancel(id, user.id);
  }

  @Put(':id')
  @RequirePermission('orders', 'edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.orders.update(id, dto, user);
  }
}
