import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.constants';
import { InventoryService } from './inventory.service';
import { CheckIssueDto, CreateIssueDto, UpdateIssueDto } from './dto/inventory.dto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('issues')
  @RequirePermission('inventory', 'view')
  findIssues(@Query('facilityId') facilityId?: string, @Query('status') status?: string) {
    return this.inventory.findIssues({ facilityId, status });
  }

  @Post('issues')
  @RequirePermission('inventory', 'edit')
  createIssue(@Body() dto: CreateIssueDto, @CurrentUser() user: RequestUser) {
    return this.inventory.createIssue(dto, user.id);
  }

  @Put('issues/:id')
  @RequirePermission('inventory', 'edit')
  updateIssue(
    @Param('id') id: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventory.updateIssue(id, dto, user.id);
  }

  @Post('issues/:id/cancel')
  @RequirePermission('inventory', 'edit')
  cancelIssue(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventory.cancelIssue(id, user.id);
  }

  /** Báo cáo NXT theo cơ sở & khoảng ngày. */
  @Get('report')
  @RequirePermission('inventory', 'view')
  report(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('facilityId') facilityId?: string,
  ) {
    if (!DATE_RE.test(from ?? '') || !DATE_RE.test(to ?? '')) {
      throw new BadRequestException('from/to phải theo định dạng YYYY-MM-DD');
    }
    return this.inventory.report(facilityId, from, to);
  }

  /** Kiểm tra tồn trước khi xuất (FE chặn sớm trên UI). */
  @Post('check')
  @RequirePermission('inventory', 'view')
  check(@Body() dto: CheckIssueDto) {
    return this.inventory.check(dto);
  }

  /** Thẻ kho 1 mặt hàng. */
  @Get('card')
  @RequirePermission('inventory', 'view')
  stockCard(
    @Query('facilityId') facilityId: string,
    @Query('itemName') itemName: string,
    @Query('unit') unit: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!facilityId || !itemName) {
      throw new BadRequestException('Thiếu facilityId/itemName');
    }
    if (!DATE_RE.test(from ?? '') || !DATE_RE.test(to ?? '')) {
      throw new BadRequestException('from/to phải theo định dạng YYYY-MM-DD');
    }
    return this.inventory.stockCard({ facilityId, itemName, unit: unit ?? '', from, to });
  }
}
