'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

import { formatCurrency, loyaltyValue } from '@/lib/format/currency';
import { LOYALTY_TIER_LABELS, type QuoteLoyalty } from '@/lib/types/checkout';
import { cn } from '@/lib/utils';

/**
 * Burning points, bounded by what the server will actually allow.
 *
 * ## The cap is the quote's, not the balance
 *
 * `loyalty.max_redeemable_points` is already clamped three ways server-side —
 * by the balance, by `loyalty.max_redeem_percent` of the **discounted** subtotal,
 * and by the subtotal itself. Sliding against the raw balance would let a
 * customer pick a number the server then silently reduces, so the slider's
 * `max` is the quote's cap and nothing else.
 *
 * Because the cap moves when the coupon does, a committed value can end up above
 * a freshly lowered cap. That is **not** corrected by re-quoting — the server
 * already clamped it and reported the truth in `points_applied` / `redeem_amount`
 * — it is reported. Forcing a correction here would issue an extra quote, churn
 * every booking hold and restart the countdown, for a number the server had
 * already got right.
 *
 * ## Debounced, because a drag is not an intention
 *
 * The rupee figure moves with the thumb; the commit that re-quotes lands
 * {@link REDEEM_DEBOUNCE_MS} after the customer stops. A drag across the track
 * issues one quote, not sixty.
 *
 * A zero-balance customer gets their balance and tier as a quiet panel, not a
 * slider with `max=0` that cannot be moved.
 */

/** Plan Task 10: changing the redemption re-quotes 600 ms after the last move. */
export const REDEEM_DEBOUNCE_MS = 600;

export interface LoyaltySliderProps {
  loyalty: QuoteLoyalty;
  /** The value the parent has committed — what the current quote was priced with. */
  points: number;
  /** Debounced; changing it re-quotes. */
  onChange: (points: number) => void;
  disabled?: boolean;
  className?: string;
}

export function LoyaltySlider({
  loyalty,
  points,
  onChange,
  disabled = false,
  className,
}: LoyaltySliderProps) {
  const max = Math.max(0, Math.floor(loyalty.max_redeemable_points));
  const [draft, setDraft] = useState(points);
  const [adopted, setAdopted] = useState(points);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt the parent's value when it changes for a reason other than this
  // slider — a cleared coupon, a fresh quote, a restored step.
  //
  // Adjusting state **during render** rather than in an effect is React's own
  // recommendation for deriving from a prop change: an effect would paint the
  // stale thumb position first and then correct it, which on a slider reads as
  // a visible jump. React re-runs this component immediately, before the DOM is
  // touched, so nothing stale is ever shown.
  if (points !== adopted) {
    setAdopted(points);
    setDraft(points);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleInput = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(Math.floor(next), max));
      setDraft(clamped);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        onChange(clamped);
      }, REDEEM_DEBOUNCE_MS);
    },
    [max, onChange],
  );

  const tier = LOYALTY_TIER_LABELS[loyalty.tier];
  const sliderValue = Math.min(draft, max);
  const draftValue = loyaltyValue(sliderValue, loyalty.redeem_value_per_point);
  // The customer asked for more than this order can absorb; the server already
  // clamped it and `redeem_amount` is the truth on the summary.
  const wasCapped = points > max;

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-medium text-ink-strong">
        <Sparkles className="size-4 text-gold-text" aria-hidden="true" />
        Loyalty points
      </span>
      <span className="text-xs text-ink-muted">
        {loyalty.balance.toLocaleString('en-IN')} points · {tier}
      </span>
    </div>
  );

  if (max <= 0) {
    return (
      <div className={cn('space-y-2 rounded-xl border border-line bg-surface-raised p-4', className)}>
        {header}
        <p className="text-sm text-ink-muted">
          {loyalty.balance > 0
            ? 'None of your points can be used on this order.'
            : 'You have no points to redeem yet.'}
        </p>
        {loyalty.points_earned_estimate > 0 ? (
          <p className="text-xs text-ink-faint">
            This order earns about {loyalty.points_earned_estimate.toLocaleString('en-IN')} points
            once it is delivered or attended.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3 rounded-xl border border-line bg-surface-raised p-4', className)}>
      {header}

      <div className="space-y-2">
        <label htmlFor="checkout-redeem" className="sr-only">
          Points to redeem
        </label>
        <input
          id="checkout-redeem"
          type="range"
          min={0}
          max={max}
          step={1}
          value={sliderValue}
          disabled={disabled}
          onChange={(event) => handleInput(Number(event.target.value))}
          aria-valuetext={`${sliderValue} points, ${formatCurrency(draftValue)} off`}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken',
            'accent-[var(--accent)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        />
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-ink-subtle tabular-nums">
            {sliderValue.toLocaleString('en-IN')} of {max.toLocaleString('en-IN')} points
          </span>
          <span className="font-medium text-leaf tabular-nums">
            −{formatCurrency(draftValue)}
          </span>
        </div>
      </div>

      <p className="text-xs text-ink-faint">
        {loyalty.redeem_value_per_point > 0
          ? `${formatCurrency(loyalty.redeem_value_per_point)} per point.`
          : null}{' '}
        {loyalty.points_earned_estimate > 0
          ? `This order earns about ${loyalty.points_earned_estimate.toLocaleString('en-IN')} points once it is delivered or attended.`
          : null}
      </p>

      {wasCapped ? (
        <p role="status" className="text-xs text-warning">
          Only {max.toLocaleString('en-IN')} points can be used on this order — we applied that
          much.
        </p>
      ) : null}
    </div>
  );
}
