import { Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as express from 'express';
import { MorningBriefService } from './morning-brief.service';
import type { MorningBriefDelivery } from './morning-brief.service';
import { assertBusinessDateKey } from '../../daily-close/daily-close.service';
import { RequiresPermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../types/permissions';

/**
 * RUN-05 — the morning brief API.
 *
 * `GET latest` carries **no** `@RequiresPermission`: it returns one row that
 * already belongs to the caller, so the JWT guard is the whole gate. Adding a
 * permission would mean a lead could receive a brief and not be able to read it
 * back on the dashboard.
 *
 * `POST generate` spends a model call and writes to every lead's inbox, so it
 * takes `MANAGE_SYSTEM` and the same `short` throttler the evidence assist uses.
 */
@Controller('ai/morning-brief')
export class MorningBriefController {
  constructor(private readonly brief: MorningBriefService) {}

  /**
   * The signed-in user's most recent brief notification, or `null`.
   *
   * Task 15's `MorningBriefCard` reads exactly this shape and drops itself on
   * `null` — a day with no brief must not break Mission Control.
   */
  @Get('latest')
  latest(@Req() req: express.Request) {
    const user = (req as any).user;
    return this.brief.latestForUser(user.id);
  }

  /**
   * A manual re-run. Defaults to **yesterday** — the day the 07:00 cron reports
   * — so the common case needs no parameter; `?date=YYYY-MM-DD` re-runs another
   * day and is rejected with a 400 if it is not a real calendar date.
   *
   * Re-running the same day is safe: every recipient is inside the
   * `morning_brief` cooldown, so the response comes back with `delivered_to: 0`
   * rather than a second copy in anyone's inbox.
   */
  @Post('generate')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  async generate(@Query('date') date?: string): Promise<MorningBriefDelivery> {
    const day = date
      ? assertBusinessDateKey(date)
      : await this.brief.previousBusinessDate();
    return this.brief.generateAndDeliver(day);
  }
}
