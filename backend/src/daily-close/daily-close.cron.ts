import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DailyClose, DailyCloseStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { nodeDayKey } from '../common/utils/node-time';
import { ADVISORY_LOCK, withAdvisoryLock } from '../common/utils/advisory-lock';
import {
  DAILY_CLOSE_ENTITY_TYPE,
  DailyCloseService,
  dateToDayKey,
  dayKeyToDate,
} from './daily-close.service';

/** Where the screen lives (plan Task 12). One string, so a route change is one edit. */
export const DAILY_CLOSE_SCREEN_PATH = '/operations/daily-close';

/** `YYYY-MM-DD` shifted back one calendar day, in UTC arithmetic on the day key. */
export function previousDayKey(day: string): string {
  const date = dayKeyToDate(day);
  date.setUTCDate(date.getUTCDate() - 1);
  return dateToDayKey(date);
}

/** What one run produced, for the log line and for the spec. */
export interface DailyCloseRunResult {
  business_date: string;
  close_id: string;
  status: DailyCloseStatus;
  notified: number;
}

/**
 * RUN-02's nightly half — computes **yesterday**, then tells the signatories.
 *
 * 00:45 node-local, the `daily_close.compute_at` default: late enough that the
 * day has definitely rolled over in the node's zone, early enough to be waiting
 * on the screen before anybody opens it. It runs after the readiness snapshot
 * (00:20) and well before the loyalty expiry (02:00) and stock reconciliation
 * (02:30), so the four nightlies never contend for a connection.
 *
 * The whole body runs under `ADVISORY_LOCK.DAILY_CLOSE`, so N API instances run
 * it once between them, and it never rejects — an unhandled rejection out of a
 * `@Cron` method would take the process down.
 */
@Injectable()
export class DailyCloseCron {
  private readonly logger = new Logger(DailyCloseCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyClose: DailyCloseService,
    private readonly node: NodeService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationDispatcher,
  ) {}

  /**
   * A decorator cannot await `NodeService`, so the zone is pinned to the seeded
   * default exactly as `readiness.cron.ts` pins it; `closeYesterday` still
   * resolves the live zone at run time, so a re-zoned node closes the right day
   * even before the pin is updated.
   */
  @Cron('45 0 * * *', { timeZone: DEFAULT_NODE_TIMEZONE })
  async nightlyClose(): Promise<void> {
    try {
      const result = await withAdvisoryLock(
        this.prisma,
        ADVISORY_LOCK.DAILY_CLOSE,
        () => this.closeYesterday(),
        this.logger,
      );

      if (result === null) {
        this.logger.log('Daily close skipped — lock held by another instance');
        return;
      }

      this.logger.log(
        `Daily close ${result.status} for ${result.business_date}; ` +
          `${result.notified} signatory notification(s) written`,
      );
    } catch (error) {
      this.logger.error(
        `Daily close failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Computes **yesterday** in node time, not today: at 00:45 the day that just
   * ended is the one with a complete set of orders in it. Separated from the
   * `@Cron` wrapper so a manual re-run (and a spec) can call it without the lock.
   */
  async closeYesterday(now: Date = new Date()): Promise<DailyCloseRunResult> {
    const timeZone = await this.node.timezone();
    const day = previousDayKey(nodeDayKey(timeZone, now));

    const close = await this.dailyClose.computeAndUpsert(day);
    const notified = await this.notifySigners(day, close);

    return {
      business_date: day,
      close_id: close.id,
      status: close.status,
      notified,
    };
  }

  /**
   * One `daily_close_due` notification per holder of a `signer_role_codes` role.
   *
   * `reference_id` is the close id, so the per-type cooldown keys on the day
   * rather than on the type alone. A day that is already `signed` needs no nudge
   * — that is the re-run case, and re-notifying would be noise.
   *
   * Every write is failure-isolated: one signatory's row failing must not cost
   * the others theirs, and must never fail the close that has already landed.
   */
  private async notifySigners(day: string, close: DailyClose): Promise<number> {
    if (close.status === DailyCloseStatus.signed) return 0;

    const cfg = await this.settings.get('daily_close');
    if (cfg.signer_role_codes.length === 0) return 0;

    const signers = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: cfg.signer_role_codes } },
      },
      select: { id: true },
    });

    let written = 0;
    for (const signer of signers) {
      try {
        const dispatched = await this.notifications.dispatch({
          user_id: signer.id,
          type: NotificationType.daily_close_due,
          title: `Daily close ready for ${day}`,
          body: `Yesterday's numbers are computed and waiting for a signature.`,
          link_url: `${DAILY_CLOSE_SCREEN_PATH}?date=${day}`,
          reference_id: close.id,
          reference_type: DAILY_CLOSE_ENTITY_TYPE,
        });
        if (dispatched) written += 1;
      } catch (error) {
        this.logger.error(
          `Could not notify ${signer.id} about the ${day} daily close: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return written;
  }
}
