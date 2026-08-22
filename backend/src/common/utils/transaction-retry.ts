import { Prisma } from '@prisma/client';

/** Options for every multi-write transaction in the money path. */
export const SERIALIZABLE_TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 15000,
} as const;

/** Duck-typed Prisma error-code check (works for real errors and test doubles). */
export function hasPrismaCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === code
  );
}

/**
 * Runs `fn` and re-runs it when Postgres aborts the transaction with a
 * serialization failure (Prisma P2034). `retries` is the number of additional
 * attempts; `backoffMs` is the base delay, doubled per attempt.
 */
export async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  backoffMs = 25,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!hasPrismaCode(err, 'P2034') || attempt >= retries) throw err;
      attempt += 1;
      if (backoffMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, backoffMs * 2 ** (attempt - 1)),
        );
      }
    }
  }
}
