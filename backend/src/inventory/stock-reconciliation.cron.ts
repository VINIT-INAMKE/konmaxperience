import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NodeService } from '../node/node.service';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { ADVISORY_LOCK, withAdvisoryLock } from '../common/utils/advisory-lock';

/**
 * SPEC §3.4 / RUN-06 — the nightly stock reconciliation.
 *
 * `StockMovement` is the ledger: every receipt, consumption, waste and manual
 * adjustment writes one signed row. `IngredientStock.current_quantity` is the
 * cache every screen reads. They are written in the same transaction today, so
 * they should agree — this job is what proves it, nightly, instead of a manager
 * discovering a two-week-old drift while counting a freezer.
 *
 * It **records** drift and never repairs it: a silent correcting write would
 * destroy the only evidence of whichever code path is losing movements, and the
 * repair would then be invisible in the audit trail too. The `AuditEvent` is the
 * deliverable.
 *
 * The whole body runs under `ADVISORY_LOCK.STOCK_RECONCILIATION`, so N API
 * instances run it once between them, and it never rejects — an unhandled
 * rejection out of a `@Cron` method would take the process down.
 */
@Injectable()
export class StockReconciliationCron {
  private readonly logger = new Logger(StockReconciliationCron.name);

  /**
   * Both sides are `Decimal(14, 4)`, so anything at or below the fourth decimal
   * place is representation noise rather than a lost movement.
   */
  static readonly TOLERANCE = 0.0001;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly node: NodeService,
  ) {}

  /**
   * 02:30 node-local — after the loyalty expiry sweep at 02:00 and well clear of
   * the readiness snapshot at 00:20, so the three nightlies never contend. A
   * decorator cannot await `NodeService`, so the zone is pinned to the seeded
   * default exactly as `readiness.cron.ts` pins it.
   */
  @Cron('30 2 * * *', { timeZone: DEFAULT_NODE_TIMEZONE })
  async nightlyReconcile(): Promise<void> {
    try {
      const result = await withAdvisoryLock(
        this.prisma,
        ADVISORY_LOCK.STOCK_RECONCILIATION,
        () => this.reconcile(),
        this.logger,
      );

      if (result === null) {
        this.logger.log(
          'Stock reconciliation skipped — lock held by another instance',
        );
        return;
      }

      this.logger.log(
        `Reconciled ${result.checked} stock rows; ${result.drifted} drifted`,
      );
    } catch (error) {
      this.logger.error(
        `Stock reconciliation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Compares every `IngredientStock` row against the sum of its movements.
   * Separated from the `@Cron` wrapper so a manual run (and a spec) can call it
   * without the lock. Returns how many rows were checked and how many drifted.
   *
   * Two grouped reads, not N queries: the ledger sum per `(ingredient, zone)`
   * and the cache, joined in memory on the same key the `@@unique` uses.
   */
  async reconcile(): Promise<{ checked: number; drifted: number }> {
    const nodeId = await this.node.currentId();

    const sums = await this.prisma.stockMovement.groupBy({
      by: ['ingredient_id', 'zone_id'],
      _sum: { quantity: true },
    });
    const stocks = await this.prisma.ingredientStock.findMany({
      select: { ingredient_id: true, zone_id: true, current_quantity: true },
    });

    const ledger = new Map(
      sums.map((s) => [
        `${s.ingredient_id}:${s.zone_id}`,
        Number(s._sum.quantity ?? 0),
      ]),
    );

    let drifted = 0;
    for (const stock of stocks) {
      const key = `${stock.ingredient_id}:${stock.zone_id}`;
      // A stock row with no movements at all is expected to read zero; the
      // absence of ledger rows is itself the expectation, not a missing value.
      const expected = ledger.get(key) ?? 0;
      const actual = Number(stock.current_quantity);
      const delta = actual - expected;
      if (Math.abs(delta) <= StockReconciliationCron.TOLERANCE) continue;

      drifted += 1;
      await this.prisma.$transaction((tx) =>
        this.audit.record(tx, {
          entity_type: 'ingredient_stock',
          entity_id: key,
          action: 'stock.reconciliation_mismatch',
          node_id: nodeId,
          ...AuditService.user(null),
          before: { current_quantity: actual },
          after: { movement_sum: expected, delta },
        }),
      );
    }

    return { checked: stocks.length, drifted };
  }
}
