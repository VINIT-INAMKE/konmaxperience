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
  ForbiddenException,
} from '@nestjs/common';
import express from 'express';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { Permission } from '../types/permissions';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BlockTaskDto } from './dto/block-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * `IA-04`. `mine`, `cursor` and `limit` are additive: with neither `cursor` nor
   * `limit` the response keeps its legacy bare-array shape.
   */
  @Get()
  async findAll(
    @Req() req: express.Request,
    @Query('quest_id') questId?: string,
    @Query('mission_id') missionId?: string,
    @Query('status') status?: string,
    @Query('task_type') taskType?: string,
    @Query('view_as') viewAs?: string,
    @Query('mine') mine?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const user = (req as any).user;
    const parsedLimit =
      limit === undefined
        ? undefined
        : Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.tasksService.findAll(
      { id: user.id, roleCode: user.roleCode },
      {
        questId,
        missionId,
        status,
        taskType,
        viewAs,
        mine: mine === '1' || mine === 'true',
        cursor,
        limit: parsedLimit,
      },
    );
  }

  @Get('blocked')
  async findBlocked(@Req() req: express.Request) {
    const user = (req as any).user;
    return this.tasksService.findBlocked({
      id: user.id,
      roleCode: user.roleCode,
    });
  }

  @Get(':id')
  @RequiresPermission(Permission.VIEW_ROLE_SCOPED)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  async create(
    @Body() dto: CreateTaskDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    const perms = await getPermissionsForRole(user.roleCode, this.prisma);
    const requiredPerm =
      dto.task_type === 'adhoc'
        ? Permission.CREATE_ADHOC_TASK
        : Permission.CREATE_TASK;
    if (!perms.includes(requiredPerm)) {
      throw new ForbiddenException(`Missing permission: ${requiredPerm}`);
    }
    return this.tasksService.create(dto, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.tasksService.update(id, dto, {
      id: user.id,
      roleCode: user.roleCode,
    });
  }

  @Post(':id/block')
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockTaskDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.tasksService.block(id, dto.reason, {
      id: user.id,
      roleCode: user.roleCode,
    });
  }

  @Post(':id/unblock')
  async unblock(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.tasksService.unblock(id, {
      id: user.id,
      roleCode: user.roleCode,
    });
  }
}
