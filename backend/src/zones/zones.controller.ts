import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { ZonesService } from './zones.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  async findAll() {
    return this.zonesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.zonesService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_OPS)
  async create(@Body() dto: CreateZoneDto) {
    return this.zonesService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZoneDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    const isAdmin = user.roleCode === 'FOUNDER_ADMIN';
    return this.zonesService.update(id, dto, user.id, isAdmin);
  }

  @Delete(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.zonesService.remove(id);
  }
}
