'use client';

import { Clock, TimerOff } from 'lucide-react';

import { formatCountdown } from '@/lib/format/date';
import { cn } from '@/lib/utils';

/**
 * The 15-minute clock on a frozen price — the containment for P5a risk 5, a
 * payment captured after the booking hold it was priced against had already
 * been swept.
 *
 * `msLeft` and the two flags come from `useQuote`, which runs **one** interval
 * for the whole screen. This component renders and does not tick, so mounting
 * it twice (the sticky summary and the mobile bottom bar) costs nothing and the
 * two can never disagree by a second.
 *
 * Under {@link QUOTE_WARNING_SECONDS} (three minutes) the row turns
 * warning-toned; at zero it says so plainly and `PayButton` disables.
 */

export interface QuoteCountdownProps {
  msLeft: number;
  isExpiring: boolean;
  isExpired: boolean;
  className?: string;
}

export function QuoteCountdown({
  msLeft,
  isExpiring,
  isExpired,
  className,
}: QuoteCountdownProps) {
  const label = isExpired ? 'This price has expired' : `Price held for ${formatCountdown(msLeft)}`;

  return (
    <div
      data-slot="quote-countdown"
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        isExpired && 'border-serious/25 bg-serious/10 text-serious',
        !isExpired && isExpiring && 'border-warning/25 bg-warning/10 text-warning',
        !isExpired && !isExpiring && 'border-line bg-surface-raised text-ink-subtle',
        className,
      )}
    >
      {isExpired ? (
        <TimerOff className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Clock className="size-4 shrink-0" aria-hidden="true" />
      )}
      {/* `polite` rather than `assertive`: a clock that interrupts a screen
          reader every second would be unusable. The expiry itself is announced
          by QuoteErrorBanner, which is a real alert. */}
      <span aria-live="polite" className="font-medium tabular-nums">
        {label}
      </span>
    </div>
  );
}
