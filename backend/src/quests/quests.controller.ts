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
import { QuestsService } from './quests.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';

@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  /** `mine=1` narrows to the quests the caller owns (`IA-04`). */
  @Get()
  async findAll(
    @Req() request: express.Request,
    @Query('mission_id') missionId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('mine') mine?: string,
  ) {
    const user = (request as any).user;
    return this.questsService.findAll(
      { id: user.id, roleCode: user.roleCode },
      {
        missionId,
        page: Number(page),
        limit: Number(limit),
        mine: mine === '1' || mine === 'true',
      },
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.questsService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.CREATE_QUEST)
  async create(@Body() dto: CreateQuestDto) {
    return this.questsService.create(dto);
  }

  @Patch(':id')
  @RequiresPermission(Permission.CREATE_QUEST)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestDto,
  ) {
    return this.questsService.update(id, dto);
  }
}
