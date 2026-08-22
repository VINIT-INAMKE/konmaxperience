import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import express from 'express';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ModuleAccessService } from './module-access.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

export class UpdateModuleAccessDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  role_codes?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

@Controller('modules')
export class ModuleAccessController {
  constructor(private readonly moduleAccessService: ModuleAccessService) {}

  @Get()
  async findAll() {
    return this.moduleAccessService.findAll();
  }

  @Get('mine')
  async mine(@Req() req: express.Request) {
    // No CurrentUser decorator exists in this codebase; JwtStrategy puts
    // { id, roleCode, type } on req.user for staff sessions.
    const user = (req as any).user;
    return this.moduleAccessService.forRole(user.roleCode);
  }

  @Patch(':key')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async update(@Param('key') key: string, @Body() dto: UpdateModuleAccessDto) {
    return this.moduleAccessService.update(key, dto);
  }
}
