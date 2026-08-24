import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import express from 'express';
import {
  SUMMARY_DEFAULT_DAYS,
  SUMMARY_MAX_DAYS,
  UsageService,
  UsageSummary,
} from './usage.service';
import { CreateUsageEventDto } from './dto/create-usage-event.dto';
import { UsageSummaryQueryDto } from './dto/usage-summary-query.dto';
import { NodeService } from '../node/node.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('usage')
export class UsageController {
  constructor(
    private readonly usage: UsageService,
    private readonly node: NodeService,
  ) {}

  /**
   * Telemetry ingest. Authenticated (the global `JwtAuthGuard` covers it) but needs
   * no permission — every staff role logs its own page views. Returns 202 without
   * awaiting the write so navigation is never blocked by observability.
   */
  @Post()
  @HttpCode(202)
  record(@Body() dto: CreateUsageEventDto, @Req() req: express.Request) {
    // JwtStrategy puts { id, roleCode, type } on req.user for staff sessions.
    const user = (req as any).user;
    void this.usage.record(dto, { id: user.id, roleCode: user.roleCode });
    return { accepted: true };
  }

  /**
   * The `/admin/usage` roll-up. `days` keeps its pre-P6 meaning and default;
   * `from`/`to` pin an explicit node-local window when the screen needs one.
   * The zone is resolved here so `UsageService` stays free of `NodeService` —
   * `CustomersModule` wires the ingest half in with `PrismaService` alone.
   */
  @Get('summary')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async summary(@Query() query: UsageSummaryQueryDto): Promise<UsageSummary> {
    const parsed = Number(query.days);
    return this.usage.summary({
      timeZone: await this.node.timezone(),
      days:
        Number.isFinite(parsed) && parsed > 0
          ? Math.min(parsed, SUMMARY_MAX_DAYS)
          : SUMMARY_DEFAULT_DAYS,
      from: query.from,
      to: query.to,
    });
  }
}
