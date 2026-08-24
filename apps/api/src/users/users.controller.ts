import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.constants';
import { UsersService } from './users.service';
import { CreateUserDto, SetPermissionsDto, UpdateUserDto } from './dto/user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('users', 'view')
  findAll() {
    return this.users.findAll();
  }

  @Post()
  @RequirePermission('users', 'edit')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: RequestUser) {
    return this.users.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('users', 'edit')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: RequestUser) {
    return this.users.update(id, dto, user.id);
  }

  @Put(':id/permissions')
  @RequirePermission('users', 'edit')
  setPermissions(
    @Param('id') id: string,
    @Body() dto: SetPermissionsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.users.setPermissions(id, dto, user.id);
  }
}
