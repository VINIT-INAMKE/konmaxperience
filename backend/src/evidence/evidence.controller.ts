import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { EvidenceService } from './evidence.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { buildScopeFilter } from '../permissions/scope.filter';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { ReviewEvidenceDto } from './dto/review-evidence.dto';

@Controller('tasks/:taskId/evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get()
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

@Controller('evidence')
export class EvidenceReviewController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get()
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async findAll(
    @Query('status') status: string | undefined,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    const perms = await getPermissionsForRole(
      user.roleCode,
      (this.evidenceService as any).prisma,
    );
    const scopeFilter = buildScopeFilter({
      id: user.id,
      roleCode: user.roleCode,
      permissions: perms,
    });
    return this.evidenceService.findAll(
      { status: status || undefined },
      scopeFilter,
    );
  }

  @Post(':id/approve')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.evidenceService.approveEvidence(id, user.id);
  }

  @Post(':id/reject')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewEvidenceDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.evidenceService.rejectEvidence(id, user.id, dto.notes);
  }
}
