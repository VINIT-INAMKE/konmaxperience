import { Controller, Get, Query } from '@nestjs/common';
import { MissionBridgeService } from './mission-bridge.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

/**
 * Observability for the bridge: "what has it actually done". The dispatch
 * ledger is operator-facing plumbing, so the route is `MANAGE_SYSTEM`
 * (FOUNDER_ADMIN / TECH_LEAD) — the same gate `/settings` uses.
 */
@Controller('mission-bridge')
export class MissionBridgeController {
  constructor(private readonly missionBridgeService: MissionBridgeService) {}

  @Get('dispatches')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async listDispatches(
    @Query('limit') limit?: string,
    /** ISO-8601 `created_at` of the last row on the previous page. */
    @Query('cursor') cursor?: string,
  ) {
    return this.missionBridgeService.listDispatches(
      parseInt(limit || '50', 10),
      cursor,
    );
  }
}
