import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { nodeDayKey } from '../common/utils/node-time';
import { ADVISORY_LOCK, withAdvisoryLock } from '../common/utils/advisory-lock';
import { ReadinessDerivationService } from './readiness-derivation.service';

/**
 * SPEC §4.3 / READY-03 — the nightly half of readiness.
 *
 * `ReadinessDerivationService` owns *computing* meter values (on events and on
 * demand); this file owns *persisting the day* — one `ReadinessSnapshot` row per
 * meter per node-local day, plus the scheduled recompute that precedes it. The
 * split keeps the derivation service free of scheduling and of `@db.Date`
 * arithmetic, which is what its own doc comment already promises.
 */
@Injectable()
export class ReadinessCron {
  private readonly logger = new Logger(ReadinessCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly node: NodeService,
    private readonly derivation: ReadinessDerivationService,
  ) {}

  /**
   * One `ReadinessSnapshot` row per meter for the node-local day.
   *
   * Idempotent: re-running on the same day overwrites the value rather than
   * failing on `@@unique([meter_id, date])`, so a manual run after the cron is
   * harmless. `date` is a bare `@db.Date`, so the key is the node-local day key
   * pinned to UTC midnight — the same convention `ReadinessService.history`
   * reads back with.
   *
   * Returns the number of meters snapshotted.
   */
  async snapshotAll(): Promise<number> {
    const nodeId = await this.node.currentId();
    const timezone = await this.node.timezone();
    const day = nodeDayKey(timezone, new Date());
    const date = new Date(`${day}T00:00:00.000Z`);

    const meters = await this.prisma.readinessMeter.findMany({
      where: { node_id: nodeId },
      select: { id: true, current_value: true },
    });

    for (const meter of meters) {
      await this.prisma.readinessSnapshot.upsert({
        where: { meter_id_date: { meter_id: meter.id, date } },
        create: {
          node_id: nodeId,
          meter_id: meter.id,
          date,
          value: meter.current_value,
        },
        update: { value: meter.current_value },
      });
    }

    return meters.length;
  }

  /**
   * SPEC §4.3 — "recompute on relevant events and nightly; write `ReadinessSnapshot`
   * daily". 00:20 node-local, twenty minutes after the day has rolled over so the
   * snapshot lands on the day it summarises.
   *
   * The timezone is pinned to the seeded default for the same reason
   * `notifications.cleanup.cron.ts` pins it: a decorator cannot await
   * `NodeService`. `snapshotAll` still resolves the live zone at run time, so a
   * re-zoned node writes the right day key even before the pin is updated.
   *
   * The whole body runs under `ADVISORY_LOCK.READINESS_SNAPSHOT` so N API
   * instances run it once between them, and never rejects — an unhandled
   * rejection out of a `@Cron` method would take the process down.
   */
  @Cron('20 0 * * *', { timeZone: DEFAULT_NODE_TIMEZONE })
  async nightlyRecomputeAndSnapshot(): Promise<void> {
    try {
      const ran = await withAdvisoryLock(
        this.prisma,
        ADVISORY_LOCK.READINESS_SNAPSHOT,
        async () => {
          const meters = await this.derivation.recomputeAll();
          const snapshots = await this.snapshotAll();
          return { meters: meters.length, snapshots };
        },
      );

      if (ran === null) {
        this.logger.log(
          'Nightly readiness job skipped — lock held by another instance',
        );
        return;
      }

      this.logger.log(
        `Nightly readiness: recomputed ${ran.meters} meters, wrote ${ran.snapshots} snapshots`,
      );
    } catch (error) {
      this.logger.error(
        `Nightly readiness job failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
