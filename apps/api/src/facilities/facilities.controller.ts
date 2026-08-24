import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.constants';
import { FacilitiesService } from './facilities.service';
import { CreateFacilityDto, UpdateFacilityDto } from './dto/facility.dto';

@Controller('facilities')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FacilitiesController {
  constructor(private readonly facilities: FacilitiesService) {}

  /** Mọi user đăng nhập đều đọc được (cần cho filter cơ sở ở nhiều trang). */
  @Get()
  findAll() {
    return this.facilities.findAll();
  }

  @Post()
  @RequirePermission('settings', 'edit')
  create(@Body() dto: CreateFacilityDto, @CurrentUser() user: RequestUser) {
    return this.facilities.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('settings', 'edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFacilityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.facilities.update(id, dto, user.id);
  }
}
