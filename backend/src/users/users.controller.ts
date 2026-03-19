import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { UsersService } from './users.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequiresPermission(Permission.VIEW_ALL)
  async findAll(@Query('viewAs') viewAs?: string) {
    if (viewAs) {
      // Admin user-level filtering (AUTH-06)
      const user = await this.usersService.findOne(viewAs);
      return [user];
    }
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequiresPermission(Permission.VIEW_ALL)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_RBAC)
  async create(
    @Body() dto: CreateUserDto,
    @Req() request: express.Request,
  ) {
    const currentUser = (request as any).user;
    return this.usersService.create(
      { name: dto.name, email: dto.email, roleId: dto.roleId },
      currentUser.id,
    );
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_RBAC)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Post(':id/reset-password')
  @RequiresPermission(Permission.MANAGE_RBAC)
  async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.triggerPasswordReset(id);
    return { message: 'Password reset email sent' };
  }

  @Post(':id/deactivate')
  @RequiresPermission(Permission.MANAGE_RBAC)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(id);
  }
}
