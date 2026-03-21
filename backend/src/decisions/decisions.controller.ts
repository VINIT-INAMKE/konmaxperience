import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { DecisionsService } from './decisions.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';

@Controller('decisions')
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    return this.decisionsService.findAll(status);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.decisionsService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.CREATE_DECISION)
  async create(@Body() dto: CreateDecisionDto, @Req() req: express.Request) {
    const user = (req as any).user;
    return this.decisionsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequiresPermission(Permission.APPROVE_DECISION)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDecisionDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    const isAdmin = user.roleCode === 'FOUNDER_ADMIN';
    return this.decisionsService.update(id, dto, user.id, isAdmin);
  }

  @Delete(':id')
  @RequiresPermission(Permission.APPROVE_DECISION)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    const isAdmin = user.roleCode === 'FOUNDER_ADMIN';
    return this.decisionsService.remove(id, isAdmin);
  }
}
