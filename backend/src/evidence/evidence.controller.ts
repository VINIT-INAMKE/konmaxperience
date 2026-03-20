import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { EvidenceService } from './evidence.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@Controller('tasks/:taskId/evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get()
  @RequiresPermission(Permission.UPLOAD_EVIDENCE)
  async findByTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.evidenceService.findByTask(taskId);
  }

  @Post()
  @RequiresPermission(Permission.UPLOAD_EVIDENCE)
  async create(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateEvidenceDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.evidenceService.create(
      taskId,
      user.id,
      user.roleCode,
      dto,
    );
  }
}
