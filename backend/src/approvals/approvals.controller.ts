import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import express from 'express';
import { ApprovalsService } from './approvals.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { OverrideApprovalDto } from './dto/override-approval.dto';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('pending')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async findPending() {
    return this.approvalsService.findPending();
  }

  @Post(':id/approve')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.approvalsService.approveWithDelegation(id, user.id, user.roleCode);
  }

  @Post(':id/override')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async override(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideApprovalDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    if (user.roleCode !== 'FOUNDER_ADMIN') {
      throw new ForbiddenException('Only admin can override approvals');
    }
    return this.approvalsService.overrideApproval(id, user.id, dto.reason);
  }
}
