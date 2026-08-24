'use client';

import { Timer } from 'lucide-react';
import { formatCountdown, msUntil } from '@/lib/format/date';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { EventBooking } from '@/lib/types/events';
import { cn } from '@/lib/utils';

/**
 * The seats a checkout in flight is sitting on.
 *
 * A quote writes a `held` `EventBooking` with a fifteen-minute
 * `hold_expires_at` (`CheckoutService.createHolds`) so two customers cannot pay
 * for the same last seat. The backend's `OCCUPYING_BOOKINGS` predicate counts
 * such a row against capacity **only while `hold_expires_at > now`**, so this
 * panel shows only live holds and the countdown is the whole point of it.
 *
 * **There is no graveyard.** A released or swept hold is DELETEd, never
 * cancelled in place (`CheckoutService.releaseHolds` — the row has to go
 * because `EventBooking` is `@@unique([event_id, customer_phone])`). So a hold
 * that runs out simply stops being listed; `expiredCount` is the only trace,
 * and it exists to explain a row that vanished under the host's eyes rather
 * than to keep it around.
 *
 * Purely presentational: the parent owns the clock and the filtering, so one
 * interval drives the countdown, the capacity bar and the attendance gate
 * together and they can never disagree by a second.
 */
export interface HoldsPanelProps {
  /** Live holds only — `hold_expires_at` still in the future — already sorted. */
  holds: EventBooking[];
  /** Guests across those live holds; what the capacity summary subtracts. */
  heldGuests: number;
  /** Holds whose timer ran out but whose row the sweep has not deleted yet. */
  expiredCount: number;
  /** The parent's ticking clock, in epoch milliseconds. */
  now: number;
}

/** Under two minutes a host should expect the seat back imminently. */
const URGENT_MS = 2 * 60_000;
/** Under five minutes the checkout is past its halfway mark. */
const SOON_MS = 5 * 60_000;

function countdownTone(remainingMs: number): string {
  if (remainingMs <= URGENT_MS) return STATUS_BADGE.serious;
  if (remainingMs <= SOON_MS) return STATUS_BADGE.warning;
  return STATUS_BADGE.info;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

export function HoldsPanel({ holds, heldGuests, expiredCount, now }: HoldsPanelProps) {
  return (
    <section
      aria-labelledby="holds-panel-heading"
      className="rounded-lg bg-card ring-1 ring-foreground/10"
    >
      <header className="flex items-start gap-2 border-b border-line px-3 py-2.5">
        <Timer className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 id="holds-panel-heading" className="text-sm font-medium text-ink">
            Held by a checkout in progress
          </h3>
          <p className="text-xs text-ink-muted">
            {holds.length === 0
              ? 'Nothing is held right now. A hold appears the moment a customer quotes this experience.'
              : `${heldGuests} ${plural(heldGuests, 'guest')} across ${holds.length} ${plural(
                  holds.length,
                  'checkout',
                )} — these seats count against capacity until the timer runs out.`}
          </p>
        </div>
      </header>

      {holds.length > 0 && (
        <ul className="divide-y divide-line">
          {holds.map((hold) => {
            const remaining = msUntil(hold.hold_expires_at, now);
            return (
              <li
                key={hold.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    {hold.customer_name || 'Guest'}
                  </p>
                  <p className="truncate text-xs text-ink-muted tabular-nums">
                    {hold.customer_phone || 'No phone on file'} ·{' '}
                    {hold.guests} {plural(hold.guests, 'guest')}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-4xl border px-2 py-0.5 text-xs font-medium tabular-nums',
                    countdownTone(remaining),
                  )}
                >
                  <span className="sr-only">Releases in </span>
                  {formatCountdown(remaining)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {expiredCount > 0 && (
        <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">
          {expiredCount} {plural(expiredCount, 'hold')} just ran out. Those seats are
          already back in the pool — the row clears on the next sweep.
        </p>
      )}
    </section>
  );
}
