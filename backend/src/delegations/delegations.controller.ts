import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { DelegationsService } from './delegations.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Controller('delegations')
export class DelegationsController {
  constructor(private readonly delegationsService: DelegationsService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_DELEGATIONS)
  async findAll() {
    return this.delegationsService.findAll();
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_DELEGATIONS)
  async create(
    @Body() dto: CreateDelegationDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.delegationsService.create(dto, user.id);
  }

  @Patch(':id/deactivate')
  @RequiresPermission(Permission.MANAGE_DELEGATIONS)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.delegationsService.deactivate(id);
  }
}
