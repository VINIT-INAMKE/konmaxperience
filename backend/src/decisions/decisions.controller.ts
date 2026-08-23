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
import { DecisionsService, DecisionActor } from './decisions.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { RoleCode } from '../types/roles';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { ResolveDecisionDto } from './dto/resolve-decision.dto';

/** `req.user.roleCode` is a plain JWT string claim, not the `RoleCode` enum. */
const FOUNDER_ROLE: string = RoleCode.FOUNDER_ADMIN;

/** `JwtStrategy.validate` puts `{ id, roleCode, type }` on the request. */
function actor(req: express.Request): DecisionActor {
  return (req as unknown as { user: DecisionActor }).user;
}

@Controller('decisions')
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get()
  @RequiresPermission(Permission.VIEW_ROLE_SCOPED)
  async findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.decisionsService.findAll(status, Number(page), Number(limit));
  }

  @Get(':id')
  @RequiresPermission(Permission.VIEW_ROLE_SCOPED)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.decisionsService.findOne(id);
  }

  @Get(':id/votes')
  @RequiresPermission(Permission.VIEW_ROLE_SCOPED)
  async listVotes(@Param('id', ParseUUIDPipe) id: string) {
    return this.decisionsService.listVotes(id);
  }

  @Post()
  @RequiresPermission(Permission.CREATE_DECISION)
  async create(@Body() dto: CreateDecisionDto, @Req() req: express.Request) {
    return this.decisionsService.create(dto, actor(req));
  }

  /**
   * SPEC §4.4 tier-2 voting. Guarded by `VIEW_ROLE_SCOPED` (the one permission
   * every staff role holds) because the real ACL is the decision's own
   * `required_role_codes`, enforced in the service: `APPROVE_DECISION` is
   * seeded only on `FOUNDER_ADMIN`, so guarding on it would make the 2+1 vote
   * founder-only and the tier-2 flow unreachable.
   */
  @Post(':id/votes')
  @RequiresPermission(Permission.VIEW_ROLE_SCOPED)
  async castVote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CastVoteDto,
    @Req() req: express.Request,
  ) {
    return this.decisionsService.castVote(id, actor(req), dto);
  }

  @Post(':id/resolve')
  @RequiresPermission(Permission.APPROVE_DECISION)
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDecisionDto,
    @Req() req: express.Request,
  ) {
    return this.decisionsService.resolve(id, actor(req), dto);
  }

  @Post(':id/reopen')
  @RequiresPermission(Permission.APPROVE_DECISION)
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    return this.decisionsService.reopen(id, actor(req));
  }

  @Patch(':id')
  @RequiresPermission(Permission.APPROVE_DECISION)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDecisionDto,
    @Req() req: express.Request,
  ) {
    const user = actor(req);
    const isAdmin = user.roleCode === FOUNDER_ROLE;
    return this.decisionsService.update(id, dto, user.id, isAdmin);
  }

  @Delete(':id')
  @RequiresPermission(Permission.APPROVE_DECISION)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = actor(req);
    const isAdmin = user.roleCode === FOUNDER_ROLE;
    return this.decisionsService.remove(id, isAdmin);
  }
}
