import { cn } from '@/lib/utils';

/**
 * "11 of 16 places left" — and the sold-out state that turns the booking panel
 * off.
 *
 * ## The number is hold-aware, and that is the whole point
 *
 * `spotsRemaining` must come from `GET /events` or `GET /events/:id`, whose
 * `spots_remaining` counts a seat as taken when its booking is `confirmed`,
 * `attended`, **or** a `held` row whose fifteen-minute `hold_expires_at` has not
 * passed (`backend/src/events/events.service.ts` `OCCUPYING_BOOKINGS`). A seat
 * somebody is mid-checkout on is therefore not offered to a second customer.
 *
 * `GET /catalog/availability/:productId` counts only `confirmed` bookings and
 * must not be used here — see the note in `experience-data.ts`.
 *
 * ## No hooks, deliberately
 *
 * The list page renders this from a server component and the booking panel
 * renders it from a client one. Keeping it a pure function of its props lets
 * both do so from the same file.
 */

/** What the seat count means, once. Callers style and gate off this, not off arithmetic. */
export type CapacityState = 'sold-out' | 'last-few' | 'open' | 'unknown';

/** Below this many seats the count is worth drawing attention to. */
const LAST_FEW_THRESHOLD = 3;

export function capacityState(spotsRemaining: number | null | undefined): CapacityState {
  if (typeof spotsRemaining !== 'number' || !Number.isFinite(spotsRemaining)) return 'unknown';
  if (spotsRemaining <= 0) return 'sold-out';
  if (spotsRemaining <= LAST_FEW_THRESHOLD) return 'last-few';
  return 'open';
}

/** True when the panel must refuse to add a line. Unknown is *not* sold out. */
export function isSoldOut(spotsRemaining: number | null | undefined): boolean {
  return capacityState(spotsRemaining) === 'sold-out';
}

export interface CapacityNoteProps {
  /** Hold-aware seats left. `null` when unknown — a past sitting, or an unenriched row. */
  spotsRemaining: number | null;
  /** `Event.capacity` — the denominator, so "3 left" of 4 reads differently from 3 of 60. */
  capacity: number;
  size?: 'sm' | 'md';
  /** Suppresses the dot marker — for a line already inside a bordered panel. */
  bare?: boolean;
  className?: string;
}

const DOT_CLASS: Record<CapacityState, string> = {
  'sold-out': 'bg-ink-faint',
  'last-few': 'bg-gold',
  open: 'bg-leaf',
  unknown: 'bg-ink-faint',
};

const TEXT_CLASS: Record<CapacityState, string> = {
  'sold-out': 'text-ink-muted',
  'last-few': 'text-gold-text font-medium',
  open: 'text-ink-subtle',
  unknown: 'text-ink-muted',
};

function capacityLabel(state: CapacityState, spots: number, capacity: number): string {
  switch (state) {
    case 'sold-out':
      return capacity > 0 ? `Sold out · all ${capacity} places taken` : 'Sold out';
    case 'last-few':
      return spots === 1
        ? `Last place — 1 of ${capacity} left`
        : `Only ${spots} of ${capacity} places left`;
    case 'open':
      return `${spots} of ${capacity} places left`;
    default:
      return 'This sitting has finished';
  }
}

export function CapacityNote({
  spotsRemaining,
  capacity,
  size = 'md',
  bare = false,
  className,
}: CapacityNoteProps) {
  const state = capacityState(spotsRemaining);
  const spots = typeof spotsRemaining === 'number' ? Math.max(0, spotsRemaining) : 0;

  return (
    <p
      data-slot="capacity-note"
      data-state={state}
      className={cn(
        'flex items-center gap-2',
        size === 'sm' ? 'text-xs' : 'text-sm',
        TEXT_CLASS[state],
        className,
      )}
    >
      {bare ? null : (
        <span
          aria-hidden="true"
          className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[state])}
        />
      )}
      {capacityLabel(state, spots, capacity)}
    </p>
  );
}
