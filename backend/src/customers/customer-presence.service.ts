import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsageService } from '../usage/usage.service';

/**
 * How long a customer stays "seen" before another request is worth a write.
 * Fifteen minutes is a session, not a page view: the staff screen shows
 * `last_seen_at` to the minute, and no product decision turns on finer grain.
 */
export const PRESENCE_WINDOW_MS = 15 * 60_000;

/**
 * Ceiling on the in-memory throttle map. One `Map` entry is ~64 bytes, so
 * 20 000 concurrent customers cost about a megabyte; past that the map is
 * pruned of everything already outside the window.
 */
export const PRESENCE_MAX_TRACKED = 20_000;

/**
 * Keeps `Customer.last_seen_at` fresh without putting a write on the hot path.
 *
 * Every customer-authenticated request passes through
 * `CustomerPresenceInterceptor`, which calls {@link touch}. The naive version
 * of that — one `UPDATE` per request — would double the write load of the
 * storefront to maintain a field nobody reads more than once a day. So:
 *
 * - **Throttled in memory.** A `Map<customerId, epochMs>` suppresses every
 *   touch inside {@link PRESENCE_WINDOW_MS}. The map is per process; with two
 *   API instances a customer costs at most two writes per window, which is
 *   still two orders of magnitude below one per request. No Redis round trip,
 *   because a Redis `GET` per request is the very cost being avoided.
 * - **Fire-and-forget.** {@link touch} returns `void` synchronously and the
 *   write is never awaited: telemetry must not be able to fail, slow or
 *   reorder a customer's checkout.
 * - **Self-healing.** If the write rejects (row deleted, database blip) the
 *   map entry is dropped so the next request retries instead of waiting out
 *   the whole window.
 *
 * The same throttled beat also lands one `UsageEvent(page_view)` per customer
 * per window via {@link UsageService.recordCustomerVisit}, which is what makes
 * the storefront visible at all in the `GET /usage/summary` roll-up — that
 * table is otherwise fed only by the staff app's own `POST /usage`.
 */
@Injectable()
export class CustomerPresenceService {
  private readonly logger = new Logger(CustomerPresenceService.name);
  private readonly lastTouch = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  /**
   * Records that `customerId` is active right now, at most once per
   * {@link PRESENCE_WINDOW_MS}. Synchronous and never throws.
   */
  touch(customerId: string, path?: string | null): void {
    const now = Date.now();
    const previous = this.lastTouch.get(customerId);
    if (previous !== undefined && now - previous < PRESENCE_WINDOW_MS) return;

    // Claim the window *before* the write so a burst of concurrent requests
    // produces one UPDATE, not one per request in flight.
    this.lastTouch.set(customerId, now);
    this.prune(now);
    void this.write(customerId, path ?? null, now);
  }

  /** Test seam — clears the throttle so a suite can replay a window. */
  reset(): void {
    this.lastTouch.clear();
  }

  private async write(
    customerId: string,
    path: string | null,
    now: number,
  ): Promise<void> {
    try {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { last_seen_at: new Date(now) },
      });
    } catch (err) {
      // Drop the claim so the next request retries rather than waiting out the
      // window on a transient failure.
      this.lastTouch.delete(customerId);
      this.logger.debug(
        `last_seen_at touch dropped for ${customerId}: ${(err as Error).message}`,
      );
      return;
    }
    await this.usage.recordCustomerVisit({ customerId, path });
  }

  /** Bounded map: past the ceiling, forget everyone outside the window. */
  private prune(now: number): void {
    if (this.lastTouch.size <= PRESENCE_MAX_TRACKED) return;
    for (const [id, at] of this.lastTouch) {
      if (now - at >= PRESENCE_WINDOW_MS) this.lastTouch.delete(id);
    }
  }
}
