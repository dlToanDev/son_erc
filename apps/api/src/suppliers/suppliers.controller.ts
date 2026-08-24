import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.constants';
import { SuppliersService } from './suppliers.service';
import {
  CreateProductDto,
  CreateSupplierDto,
  UpdateProductDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  /** Lấy danh sách NCC — mọi user đăng nhập đều đọc được để chọn NCC khi đặt hàng / nhập kho. */
  @Get()
  findAll(@Query('search') search?: string) {
    return this.suppliers.findAll(search);
  }

  @Get(':id')
  @RequirePermission('suppliers', 'view')
  findOne(@Param('id') id: string) {
    return this.suppliers.findOne(id);
  }

  @Post()
  @RequirePermission('suppliers', 'edit')
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: RequestUser) {
    return this.suppliers.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('suppliers', 'edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliers.update(id, dto, user.id);
  }

  // ---- Products ----

  /** Lấy danh sách mặt hàng của NCC — mọi user đăng nhập đều đọc được để chọn sản phẩm khi đặt hàng. */
  @Get(':id/products')
  findProducts(@Param('id') id: string) {
    return this.suppliers.findProducts(id);
  }

  @Post(':id/products')
  @RequirePermission('products', 'edit')
  createProduct(
    @Param('id') id: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliers.createProduct(id, dto, user.id);
  }

  @Patch(':id/products/:productId')
  @RequirePermission('products', 'edit')
  updateProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliers.updateProduct(id, productId, dto, user.id);
  }

  @Delete(':id/products/:productId')
  @RequirePermission('products', 'edit')
  deleteProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliers.deleteProduct(id, productId, user.id);
  }
}
