import { Prisma } from '@prisma/client';

/**
 * The client handed to a `$transaction(async (tx) => …)` callback.
 * Promoted from the module-local alias in `fulfilment.service.ts` so audit,
 * catalog and node code can type their `tx` parameters instead of using `any`.
 */
export type Tx = Prisma.TransactionClient;
