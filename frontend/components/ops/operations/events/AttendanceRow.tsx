'use client';

import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format/currency';
import { formatCountdown, formatDateTime, msUntil } from '@/lib/format/date';
import { STATUS_BADGE } from '@/lib/status-styles';
import {
  BOOKING_PAYMENT_STATUS_LABELS,
  BOOKING_STATUS_LABELS,
  type BookingPaymentStatus,
  type BookingStatus,
  type EventBooking,
} from '@/lib/types/events';
import { cn } from '@/lib/utils';

/**
 * The two terminal states `POST /events/:id/attendance` accepts. Narrower than
 * `BookingStatus` on purpose — `held`, `confirmed` and `cancelled` are reachable
 * only from checkout, the hold sweep or a refund, never from this screen
 * (`MarkAttendanceDto`).
 */
export type AttendanceStatus = Extract<BookingStatus, 'attended' | 'no_show'>;

/**
 * Meaning, not hue. `no_show` is `serious` rather than `critical` because it is
 * a recorded outcome, not a fault; `cancelled` is `muted` because the seat was
 * given back and the row is only history.
 */
const BOOKING_STATUS_BADGE: Record<BookingStatus, string> = {
  held: STATUS_BADGE.warning,
  confirmed: STATUS_BADGE.info,
  attended: STATUS_BADGE.good,
  no_show: STATUS_BADGE.serious,
  cancelled: STATUS_BADGE.muted,
};

const PAYMENT_STATUS_BADGE: Record<BookingPaymentStatus, string> = {
  paid: STATUS_BADGE.good,
  free: STATUS_BADGE.info,
  pending: STATUS_BADGE.warning,
  refunded: STATUS_BADGE.muted,
};

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-4xl border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface AttendanceRowProps {
  booking: EventBooking;
  /**
   * True once the experience has started. Attendance before the event has
   * happened would be a guess, so the actions stay disabled until then.
   */
  canMark: boolean;
  /** This row's own mutation is in flight. */
  isPending: boolean;
  /** Any attendance mutation is in flight — one write at a time. */
  isBusy: boolean;
  /** The parent's ticking clock, for a `held` row's countdown. */
  now: number;
  onMark: (booking: EventBooking, status: AttendanceStatus) => void;
}

export function AttendanceRow({
  booking,
  canMark,
  isPending,
  isBusy,
  now,
  onMark,
}: AttendanceRowProps) {
  // Only a `confirmed` booking can be marked — `EventsService.markAttendance`
  // rejects every other state with a 400, and `attended`/`no_show` are terminal
  // there, so there is no "undo" to offer once one is set.
  const actionable = booking.status === 'confirmed';
  const heldRemaining =
    booking.status === 'held' ? msUntil(booking.hold_expires_at, now) : 0;

  return (
    <TableRow className={cn(booking.status === 'cancelled' && 'text-ink-muted')}>
      <TableCell className="align-top">
        <p className="font-medium text-ink">{booking.customer_name || 'Guest'}</p>
        <p className="text-xs text-ink-muted tabular-nums">
          {booking.customer_phone || 'No phone on file'}
        </p>
        <p className="text-xs text-ink-muted">
          Booked {formatDateTime(booking.created_at)}
        </p>
      </TableCell>

      <TableCell className="align-top tabular-nums">{booking.guests}</TableCell>

      <TableCell className="hidden align-top sm:table-cell">
        <Chip className={PAYMENT_STATUS_BADGE[booking.payment_status]}>
          {BOOKING_PAYMENT_STATUS_LABELS[booking.payment_status]}
        </Chip>
        {booking.payment_amount !== null && (
          <p className="mt-1 text-xs text-ink-muted tabular-nums">
            {formatCurrency(booking.payment_amount)}
          </p>
        )}
      </TableCell>

      <TableCell className="align-top">
        <Chip className={BOOKING_STATUS_BADGE[booking.status]}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </Chip>
        {booking.status === 'held' && (
          <p className="mt-1 text-xs text-ink-muted tabular-nums">
            {heldRemaining > 0
              ? `Releases in ${formatCountdown(heldRemaining)}`
              : 'Hold expired'}
          </p>
        )}
      </TableCell>

      <TableCell className="align-top">
        {actionable ? (
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              size="sm"
              disabled={!canMark || isBusy}
              title={
                canMark ? undefined : 'Attendance opens when the experience starts.'
              }
              onClick={() => onMark(booking, 'attended')}
            >
              {isPending ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              Attended
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canMark || isBusy}
              title={
                canMark ? undefined : 'Attendance opens when the experience starts.'
              }
              onClick={() => onMark(booking, 'no_show')}
            >
              <X aria-hidden="true" />
              No-show
            </Button>
          </div>
        ) : (
          <p className="text-right text-xs text-ink-muted">
            {booking.status === 'cancelled' ? 'Seat released' : 'Marked'}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
