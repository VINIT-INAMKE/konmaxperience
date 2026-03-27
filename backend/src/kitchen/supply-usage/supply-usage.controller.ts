import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import * as express from 'express';
import { RequiresPermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../types/permissions';
import { SupplyUsageService } from './supply-usage.service';
import { CreateSupplyUsageDto } from './dto/create-supply-usage.dto';

@Controller('kitchen/supply-usage')
export class SupplyUsageController {
  constructor(private readonly service: SupplyUsageService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  create(@Body() dto: CreateSupplyUsageDto, @Req() req: express.Request) {
    const user = (req as any).user;
    return this.service.create(dto, user.id);
  }
}
