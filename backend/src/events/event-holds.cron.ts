import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ADVISORY_LOCK, withAdvisoryLock } from '../common/utils/advisory-lock';

/**
 * Advisory-lock id for the five-minute booking-hold sweep.
 *
 * P6 (RUN-06) folded it into the one registry in `common/utils/advisory-lock.ts`
 * — the Postgres advisory namespace is a single 64-bit key space shared by the
 * whole database, and a number spread across three files is a number waiting to
 * be reused. The named re-export stays so no import breaks.
 */
export const BOOKING_HOLD_SWEEP_LOCK_ID = ADVISORY_LOCK.BOOKING_HOLD_SWEEP;

/**
 * Bookings whose hold has run out and which therefore have to go.
 *
 * A `held` row with **no** `hold_expires_at` is swept too: `OCCUPYING_BOOKINGS`
 * treats it as not occupying capacity (`hold_expires_at: { gt: now }` never
 * matches NULL), so leaving it behind would be a row that blocks
 * `@@unique([event_id, customer_phone])` forever while protecting no seat.
 * `CheckoutService.createHolds` always writes the column, so in practice this
 * branch only catches corruption.
 */
export function expiredHoldWhere(now: Date): Prisma.EventBookingWhereInput {
  return {
    status: BookingStatus.held,
    OR: [{ hold_expires_at: { lte: now } }, { hold_expires_at: null }],
  };
}

/**
 * SPEC §5.2 / §8 — a checkout quote holds an experience seat for fifteen
 * minutes; an abandoned checkout must give that seat back.
 *
 * Capacity reads already ignore an expired hold (`OCCUPYING_BOOKINGS` in
 * `events.service.ts`), so this sweep is not what makes overselling impossible
 * — it is what stops the table filling with dead rows and, more importantly,
 * what frees `@@unique([event_id, customer_phone])` so the same customer can
 * quote the same experience again.
 *
 * The row is **deleted, not cancelled**, exactly as
 * `CheckoutService.releaseHolds` deletes: a hold is an ephemeral placeholder
 * and that unique constraint has no room for a tombstone. A `confirmed`,
 * `cancelled`, `attended` or `no_show` booking is a real record and is never
 * touched.
 *
 * The body runs under `pg_try_advisory_lock`, so N API instances run it once
 * between them, and it never rejects — an unhandled rejection out of a `@Cron`
 * method would take the process down.
 */
@Injectable()
export class EventHoldsCron {
  private readonly logger = new Logger(EventHoldsCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepExpiredHolds(): Promise<void> {
    try {
      const released = await withAdvisoryLock(
        this.prisma,
        BOOKING_HOLD_SWEEP_LOCK_ID,
        () => this.releaseExpiredHolds(),
        this.logger,
      );

      if (released === null) {
        this.logger.debug(
          'Booking hold sweep skipped — lock held by another instance',
        );
        return;
      }

      if (released > 0) {
        this.logger.log(`Released ${released} expired booking holds`);
      }
    } catch (error) {
      this.logger.error(
        `Booking hold sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Deletes every expired hold in one statement. Separated from the `@Cron`
   * wrapper so a manual fix-up (and a spec) can call it without the lock.
   * Returns the number of rows removed.
   */
  async releaseExpiredHolds(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.eventBooking.deleteMany({
      where: expiredHoldWhere(now),
    });
    return count;
  }
}
