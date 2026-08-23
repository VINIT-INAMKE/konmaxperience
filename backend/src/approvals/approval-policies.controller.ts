import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApprovalPolicyService } from './approval-policy.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateApprovalPolicyDto } from './dto/create-approval-policy.dto';
import { UpdateApprovalPolicyDto } from './dto/update-approval-policy.dto';

/**
 * SPEC §9 `approval-policies`. Governance configuration, so every route is
 * `MANAGE_SYSTEM` (FOUNDER_ADMIN / TECH_LEAD) — the same gate `/settings` uses.
 */
@Controller('approval-policies')
export class ApprovalPoliciesController {
  constructor(private readonly approvalPolicyService: ApprovalPolicyService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async findAll() {
    return this.approvalPolicyService.findAll();
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async create(@Body() dto: CreateApprovalPolicyDto) {
    return this.approvalPolicyService.create(dto);
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApprovalPolicyDto,
  ) {
    return this.approvalPolicyService.update(id, dto);
  }

  @Delete(':id')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvalPolicyService.remove(id);
  }
}
