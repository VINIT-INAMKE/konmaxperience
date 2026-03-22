import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { KpisService } from './kpis.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { UpdateKpiDto } from './dto/update-kpi.dto';

@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get()
  async findAll(
    @Req() req: express.Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = (req as any).user;
    return this.kpisService.findAll(user.roleCode, Number(page), Number(limit));
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.kpisService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_KPIS)
  async create(@Body() dto: CreateKpiDto) {
    return this.kpisService.create(dto);
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_KPIS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKpiDto,
  ) {
    return this.kpisService.update(id, dto);
  }
}
