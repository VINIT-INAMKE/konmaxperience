import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoyaltyReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { withAdvisoryLock } from '../common/utils/advisory-lock';

/**
 * Advisory-lock id for the nightly loyalty expiry sweep.
 *
 * The Postgres advisory namespace is one 64-bit key space shared by the whole
 * database, so this number may never be reused by another job. It is declared
 * here rather than in `ADVISORY_LOCK` because P5a Task 7 does not own
 * `common/utils/advisory-lock.ts`; folding it into that registry is a one-line
 * post-merge follow-up. `3_1xx_xxx` is P3's block (readiness holds `3_100_001`),
 * `5_7xx_xxx` is P5a's.
 */
export const LOYALTY_EXPIRY_LOCK_ID = 5_700_101;

/** Rows per pass. Bounded so one very old backlog cannot hold a connection all night. */
export const EXPIRY_BATCH_SIZE = 500;

/** Safety stop: at most this many passes per run (250k rows) before deferring to tomorrow. */
const MAX_BATCHES = 500;

/**
 * SPEC §5.4 / §8 — points expire `loyalty.expiry_days` (365) after they are earned.
 *
 * The ledger is the source of truth: every `earn` row carries `expires_at`, and
 * this job turns a due row into a matching `expire` row and flags the original
 * `expired` so it is never counted twice. Each row is its own transaction, so a
 * failure part-way through costs one customer's sweep, not the night's.
 *
 * The whole body runs under `pg_try_advisory_lock`, so N API instances run it
 * once between them, and never rejects — an unhandled rejection out of a `@Cron`
 * method would take the process down.
 */
@Injectable()
export class LoyaltyExpiryCron {
  private readonly logger = new Logger(LoyaltyExpiryCron.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 02:00 node-local. A decorator cannot await `NodeService`, so the zone is
   * pinned to the seeded default exactly as `readiness.cron.ts` pins it.
   */
  @Cron('0 2 * * *', { timeZone: DEFAULT_NODE_TIMEZONE })
  async nightlyExpiry(): Promise<void> {
    try {
      const expired = await withAdvisoryLock(
        this.prisma,
        LOYALTY_EXPIRY_LOCK_ID,
        () => this.expirePoints(),
      );

      if (expired === null) {
        this.logger.log(
          'Nightly loyalty expiry skipped — lock held by another instance',
        );
        return;
      }

      this.logger.log(`Expired ${expired} loyalty earn rows`);
    } catch (error) {
      this.logger.error(
        `Nightly loyalty expiry failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Sweeps every `earn` row whose `expires_at` has passed, oldest first.
   * Separated from the `@Cron` wrapper so it is callable from a manual fix-up
   * (and testable) without the lock. Returns the number of rows expired.
   */
  async expirePoints(now: Date = new Date()): Promise<number> {
    let total = 0;

    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const due = await this.prisma.loyaltyTransaction.findMany({
        where: {
          reason: LoyaltyReason.earn,
          expired: false,
          expires_at: { lte: now },
        },
        orderBy: { created_at: 'asc' },
        take: EXPIRY_BATCH_SIZE,
        select: { id: true, customer_id: true, delta: true },
      });
      if (due.length === 0) break;

      for (const row of due) {
        await this.expireOne(row.id, row.customer_id, row.delta);
        total += 1;
      }

      if (due.length < EXPIRY_BATCH_SIZE) break;
    }

    return total;
  }

  /**
   * One earn row → one `expire` row, in one transaction.
   *
   * The deduction is floored at the current balance: points earned a year ago
   * may already have been spent, and an expiry must never push an account
   * negative. Flagging the source row `expired` happens in the same transaction,
   * so a crash between the two writes replays cleanly.
   */
  private async expireOne(
    id: string,
    customerId: string,
    delta: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({
        where: { customer_id: customerId },
      });
      if (!account) {
        await tx.loyaltyTransaction.update({
          where: { id },
          data: { expired: true },
        });
        return;
      }

      const expire = Math.max(0, Math.min(account.points_balance, delta));
      const balanceAfter = account.points_balance - expire;

      await tx.loyaltyAccount.update({
        where: { customer_id: customerId },
        data: { points_balance: balanceAfter },
      });
      await tx.loyaltyTransaction.create({
        data: {
          customer_id: customerId,
          delta: -expire,
          balance_after: balanceAfter,
          reason: LoyaltyReason.expire,
          notes: `Expired earn ${id}`,
        },
      });
      await tx.loyaltyTransaction.update({
        where: { id },
        data: { expired: true },
      });
    });
  }
}
