import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import * as express from 'express';
import {
  DailyCloseService,
  DailyCloseView,
  assertBusinessDateKey,
  present,
} from './daily-close.service';
import { ListDailyCloseDto } from './dto/list-daily-close.dto';
import { SignDailyCloseDto } from './dto/sign-daily-close.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

/**
 * RUN-02 — the daily close API.
 *
 * `MANAGE_OPS` gates all four routes; signing carries a *second* gate inside the
 * service (`daily_close.signer_role_codes`), because "may run operations" and
 * "is accountable for the day" are different claims and SPEC names the second.
 *
 * Every `:date` is a node-local `YYYY-MM-DD` and is rejected with a 400 by
 * `assertBusinessDateKey` before any query runs.
 */
@Controller('daily-close')
export class DailyCloseController {
  constructor(private readonly dailyClose: DailyCloseService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_OPS)
  async list(@Query() query: ListDailyCloseDto): Promise<DailyCloseView[]> {
    const rows = await this.dailyClose.list(query);
    return rows.map(present);
  }

  @Get(':date')
  @RequiresPermission(Permission.MANAGE_OPS)
  async findOne(@Param('date') date: string): Promise<DailyCloseView> {
    return present(
      await this.dailyClose.findByDate(assertBusinessDateKey(date)),
    );
  }

  /**
   * Refreshes an `open` day's numbers on demand — for a day the cron missed, or
   * one whose figures moved after a late correction. A `signed` day comes back
   * untouched rather than erroring: the request is satisfied, the artefact is
   * frozen, and the caller can see both from the response.
   */
  @Post(':date/recompute')
  @RequiresPermission(Permission.MANAGE_OPS)
  async recompute(@Param('date') date: string): Promise<DailyCloseView> {
    return present(
      await this.dailyClose.computeAndUpsert(assertBusinessDateKey(date)),
    );
  }

  @Post(':date/sign')
  @RequiresPermission(Permission.MANAGE_OPS)
  async sign(
    @Param('date') date: string,
    @Body() dto: SignDailyCloseDto,
    @Req() req: express.Request,
  ): Promise<DailyCloseView> {
    const user = (req as any).user;
    return present(
      await this.dailyClose.sign(
        assertBusinessDateKey(date),
        user.id,
        dto.notes ?? null,
      ),
    );
  }
}
