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
import { MissionsService } from './missions.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';

@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  async findAll(
    @Req() request: express.Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = (request as any).user;
    return this.missionsService.findAll(
      { id: user.id, roleCode: user.roleCode },
      Number(page),
      Number(limit),
    );
  }

  @Get('mission-control')
  async getMissionControl(@Req() request: express.Request) {
    const user = (request as any).user;
    return this.missionsService.getMissionControl({
      id: user.id,
      roleCode: user.roleCode,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.missionsService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.CREATE_MISSION)
  async create(
    @Body() dto: CreateMissionDto,
    @Req() request: express.Request,
  ) {
    const user = (request as any).user;
    return this.missionsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequiresPermission(Permission.CREATE_MISSION)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMissionDto,
  ) {
    return this.missionsService.update(id, dto);
  }
}
