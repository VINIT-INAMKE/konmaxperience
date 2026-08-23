import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import express from 'express';
import { ApprovalStatus } from '@prisma/client';
import { ApprovalsService } from './approvals.service';
import type { ActingUser } from './approvals.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { RoleCode } from '../types/roles';
import { OverrideApprovalDto } from './dto/override-approval.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';
import { ListApprovalsDto } from './dto/list-approvals.dto';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  private actingUser(req: express.Request): ActingUser {
    const user = (req as any).user;
    return { id: user.id, roleCode: user.roleCode };
  }

  /** SPEC §6.2/§9 — the inbox: `GET /approvals?mine=1&status=pending`. */
  @Get()
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async findApprovals(
    @Query() query: ListApprovalsDto,
    @Req() req: express.Request,
  ) {
    return this.approvalsService.findApprovals(this.actingUser(req), query);
  }

  /** SPEC §6.1 — the "approvals waiting on me" badge. */
  @Get('count')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async countForUser(@Req() req: express.Request) {
    return this.approvalsService.countForUser(this.actingUser(req));
  }

  /** Kept from v1: every pending approval, unnarrowed. */
  @Get('pending')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async findPending() {
    return this.approvalsService.findPending();
  }

  /** SPEC §4.4 — `POST /approvals/:id/decide { decision, note? }`. */
  @Post(':id/decide')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideApprovalDto,
    @Req() req: express.Request,
  ) {
    return this.approvalsService.decide(id, this.actingUser(req), dto);
  }

  /** Alias kept for the v1 client. */
  @Post(':id/approve')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    return this.approvalsService.decide(id, this.actingUser(req), {
      status: ApprovalStatus.approved,
    });
  }

  /**
   * Alias kept for symmetry with `/approve`. SPEC §6.4 requires a note on
   * reject — `normaliseDecision` raises `BadRequestException` without one.
   */
  @Post(':id/reject')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideApprovalDto,
    @Req() req: express.Request,
  ) {
    return this.approvalsService.decide(id, this.actingUser(req), {
      ...dto,
      status: ApprovalStatus.rejected,
      decision: undefined,
    });
  }

  @Post(':id/override')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async override(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideApprovalDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    if (user.roleCode !== RoleCode.FOUNDER_ADMIN) {
      throw new ForbiddenException('Only admin can override approvals');
    }
    return this.approvalsService.overrideApproval(id, user.id, dto.reason);
  }
}
