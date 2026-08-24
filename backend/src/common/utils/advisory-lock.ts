import { Prisma } from '@prisma/client';

/**
 * The slice of `PrismaService` the helper touches. Declaring it structurally (a) keeps
 * `common/utils` free of a Nest dependency and (b) lets a spec pass one `jest.fn()`.
 *
 * Both statements go through `$queryRaw`: the acquire reads `pg_try_advisory_lock`
 * and, since P6, the release reads `pg_advisory_unlock` instead of discarding it.
 */
export type AdvisoryLockClient = {
  $queryRaw: (query: Prisma.Sql) => Promise<unknown>;
};

/** The minimum a caller must supply for the unlock check to be visible. */
export type AdvisoryLockLogger = { error(msg: string): void };

/**
 * Stable lock ids — never reuse a number for a different job.
 *
 * One 64-bit key space for the whole database, blocked by the phase that
 * introduced the job: `3_1xx_xxx` P3, `5_7xx_xxx` P5a, `6_35x_xxx` P6.
 * (The pre-P6 comment reserved the "next" block for RUN-06; P5a took it first,
 * so the convention is recorded as it actually shipped.)
 */
export const ADVISORY_LOCK = {
  READINESS_SNAPSHOT: 3_100_001, // P3 — readiness.cron.ts
  LOYALTY_EXPIRY: 5_700_101, // P5a — loyalty.cron.ts (was inline)
  BOOKING_HOLD_SWEEP: 5_700_102, // P5a — event-holds.cron.ts (was inline)
  STOCK_RECONCILIATION: 6_350_001, // P6 — inventory/stock-reconciliation.cron.ts
  DAILY_CLOSE: 6_350_002, // P6 — daily-close/daily-close.cron.ts
  MORNING_BRIEF: 6_350_003, // P6 — ai/morning-brief/morning-brief.cron.ts
  STAFF_NUDGE_SWEEP: 6_350_004, // P6 — notifications/staff-nudge.cron.ts
  R2_ORPHAN_SWEEP: 6_350_005, // P6 — storage/orphan-sweep.cron.ts
} as const;

/**
 * Runs `fn` only if this process wins the Postgres advisory lock for `key`, so N API
 * instances run a nightly job once between them (SPEC §8 — "crons wrapped in
 * `pg_try_advisory_lock`"). Returns `null` when the lock was already held, which is
 * how a caller distinguishes "someone else is running it" from a real result.
 *
 * `pg_try_advisory_lock` never blocks: it returns `false` immediately rather than
 * queueing, so a losing instance costs one round-trip. The lock is released in a
 * `finally`, so a throwing `fn` still unlocks and the error propagates to the caller.
 *
 * Caveat worth knowing: `pg_advisory_lock` is *session*-scoped and Prisma pools its
 * connections, so lock and unlock are only guaranteed to share a session while the
 * two statements are issued back-to-back on an otherwise idle client — which is the
 * case for every job that uses this helper (nightly, weekly, or a five-minute sweep
 * that does one `deleteMany`). Converting to `pg_try_advisory_xact_lock` inside an
 * interactive `$transaction` would force the per-row transactions those jobs
 * deliberately use into one long-held transaction, trading a theoretical pooling
 * hazard for a real lock-contention one — so instead the unlock is *checked*, below.
 *
 * `logger` is optional so the helper keeps zero Nest dependencies; a cron passes its
 * own `Logger` and a failed release becomes visible instead of silent.
 */
export async function withAdvisoryLock<T>(
  prisma: AdvisoryLockClient,
  key: number,
  fn: () => Promise<T>,
  logger?: AdvisoryLockLogger,
): Promise<T | null> {
  const rows = (await prisma.$queryRaw(
    Prisma.sql`SELECT pg_try_advisory_lock(${key}::bigint) AS locked`,
  )) as { locked: boolean }[] | null | undefined;

  if (!rows?.[0]?.locked) return null;

  try {
    return await fn();
  } finally {
    // `pg_advisory_unlock` returns false when this session does not hold the
    // lock — which is exactly what a pooled connection swap looks like, and
    // which wedges the id until the connection is recycled. Ignoring the
    // result (the pre-P6 behaviour) makes that failure invisible; a job that
    // silently stops running is the worst outcome for a nightly.
    const unlocked = (await prisma.$queryRaw(
      Prisma.sql`SELECT pg_advisory_unlock(${key}::bigint) AS released`,
    )) as { released: boolean }[] | null | undefined;
    if (!unlocked?.[0]?.released) {
      logger?.error(
        `Advisory lock ${key} could not be released by this session — it may be ` +
          `held until the pooled connection is recycled. If this recurs, the job ` +
          `must move to pg_try_advisory_xact_lock inside an interactive transaction.`,
      );
    }
  }
}
