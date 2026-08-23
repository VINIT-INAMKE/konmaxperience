import { Prisma } from '@prisma/client';

/**
 * The slice of `PrismaService` the helper touches. Declaring it structurally (a) keeps
 * `common/utils` free of a Nest dependency and (b) lets a spec pass two `jest.fn()`s.
 */
export type AdvisoryLockClient = {
  $queryRaw: (query: Prisma.Sql) => Promise<unknown>;
  $executeRaw: (query: Prisma.Sql) => Promise<number>;
};

/**
 * Stable lock ids — never reuse a number for a different job.
 *
 * The namespace is a single 64-bit key space shared by the whole database, so the
 * `3_1xx_xxx` block is reserved for P3 and Phase 35's `RUN-06` takes the next one.
 */
export const ADVISORY_LOCK = {
  READINESS_SNAPSHOT: 3_100_001,
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
 * case for a nightly job. If this is ever reused on a hot path, move to
 * `pg_try_advisory_xact_lock` inside an interactive `$transaction` instead.
 */
export async function withAdvisoryLock<T>(
  prisma: AdvisoryLockClient,
  key: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const rows = (await prisma.$queryRaw(
    Prisma.sql`SELECT pg_try_advisory_lock(${key}::bigint) AS locked`,
  )) as { locked: boolean }[] | null | undefined;

  if (!rows?.[0]?.locked) return null;

  try {
    return await fn();
  } finally {
    await prisma.$executeRaw(
      Prisma.sql`SELECT pg_advisory_unlock(${key}::bigint)`,
    );
  }
}
