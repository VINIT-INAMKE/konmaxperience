import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_NODE_TIMEZONE } from '../../node/node.constants';
import {
  ADVISORY_LOCK,
  withAdvisoryLock,
} from '../../common/utils/advisory-lock';
import { MorningBriefService } from './morning-brief.service';
import type { MorningBriefDelivery } from './morning-brief.service';

/**
 * RUN-05's scheduled half — the 07:00 brief for **yesterday**.
 *
 * 07:00 is deliberately the moment the seeded quiet-hours window (21:00–07:00)
 * closes, so the brief is the first thing that may legitimately reach a phone
 * each day. It runs six hours after the 00:45 daily close, so the metrics it
 * reads are already computed and signed-off-able, and it never recomputes them.
 *
 * The whole body runs under `ADVISORY_LOCK.MORNING_BRIEF`, so N API instances
 * write one brief between them rather than one each, and it never rejects — an
 * unhandled rejection out of a `@Cron` method would take the process down.
 */
@Injectable()
export class MorningBriefCron {
  private readonly logger = new Logger(MorningBriefCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brief: MorningBriefService,
  ) {}

  /**
   * A decorator cannot await `NodeService`, so the zone is pinned to the seeded
   * default exactly as `daily-close.cron.ts` pins it; `briefYesterday` still
   * resolves the live zone at run time, so a re-zoned node briefs on the right
   * day even before the pin is updated.
   */
  @Cron('0 7 * * *', { timeZone: DEFAULT_NODE_TIMEZONE })
  async morningBrief(): Promise<void> {
    try {
      // Read the gate before taking the lock: a disabled brief is an operator
      // decision, not a failure, and must not log an error every morning.
      if (!(await this.brief.enabled())) {
        this.logger.log('Morning brief skipped — disabled in settings');
        return;
      }

      const result = await withAdvisoryLock(
        this.prisma,
        ADVISORY_LOCK.MORNING_BRIEF,
        () => this.briefYesterday(),
        this.logger,
      );

      if (result === null) {
        this.logger.log(
          'Morning brief skipped — lock held by another instance',
        );
        return;
      }

      this.logger.log(
        `Morning brief for ${result.business_date} delivered to ` +
          `${result.delivered_to}/${result.recipients} lead(s) via ${result.provider}` +
          `${result.close_available ? '' : ' (no daily close for that date)'}`,
      );
    } catch (error) {
      this.logger.error(
        `Morning brief failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Computes **yesterday** in node time and delivers it. Separated from the
   * `@Cron` wrapper so a spec (and a manual re-run) can call it without the lock.
   */
  async briefYesterday(now: Date = new Date()): Promise<MorningBriefDelivery> {
    const day = await this.brief.previousBusinessDate(now);
    return this.brief.generateAndDeliver(day);
  }
}
