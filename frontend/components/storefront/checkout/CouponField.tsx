'use client';

import { useCallback, useState } from 'react';
import { BadgeCheck, Loader2, TicketPercent, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format/currency';
import type {
  CheckoutChannel,
  CouponValidation,
  CouponValidationRequest,
  QuoteCoupon,
} from '@/lib/types/checkout';
import { cn } from '@/lib/utils';

/**
 * One coupon. No stacking UI, because `PROMO-02` bans stacking and the DTO's
 * `@IsString()` on `coupon_code` means `["A","B"]` cannot even be said.
 *
 * ## Two calls, and only one of them is the authority
 *
 * Applying hits `POST /customer/coupons/validate` first, purely for instant
 * feedback — a customer who typed a dead code learns so in one round trip
 * instead of after a full re-quote. It is **not** the source of truth: SPEC §5.4
 * says a coupon is validated inside the quote, so a successful validation only
 * sets the code, and the parent immediately re-quotes. The discount rendered in
 * `QuoteSummary` is always `quote.coupon.discount`, never the number this call
 * returned.
 *
 * ## The messages are the server's
 *
 * There is no `{ valid: false }` branch — an ineligible code answers `400` with
 * text written for the customer (`This coupon has expired`,
 * `Add ₹150.00 more to use this coupon`, `You have already used this coupon`,
 * `This coupon does not apply to the items in your cart`). It is shown verbatim.
 * Guessing at the reason would be strictly worse than what the server said, and
 * "Add ₹150.00 more" is actionable in a way that "Invalid coupon" is not.
 */

export interface CouponFieldProps {
  /** The coupon the **quote** froze — the authority on what is applied. */
  applied: QuoteCoupon | null;
  channel: CheckoutChannel;
  /** Setting a code re-quotes; `null` clears it. */
  onApply: (code: string) => void;
  onRemove: () => void;
  disabled?: boolean;
  className?: string;
}

export function CouponField({
  applied,
  channel,
  onApply,
  onRemove,
  disabled = false,
  className,
}: CouponFieldProps) {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CouponValidation | null>(null);

  const handleApply = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 3) {
      setError('Enter the code exactly as it was given to you.');
      return;
    }
    setIsValidating(true);
    setError(null);
    setPreview(null);
    try {
      const body: CouponValidationRequest = { code: trimmed, channel };
      const validation = await apiClient.post<CouponValidation>(
        '/customer/coupons/validate',
        body,
      );
      setPreview(validation);
      // The quote is the authority; this only tells it which code to price.
      onApply(trimmed);
      setCode('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'We could not check that code. Please try again.'));
    } finally {
      setIsValidating(false);
    }
  }, [channel, code, onApply]);

  const handleRemove = useCallback(() => {
    setPreview(null);
    setError(null);
    setCode('');
    onRemove();
  }, [onRemove]);

  if (applied) {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-leaf/25 bg-leaf/10 px-4 py-3',
          className,
        )}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-strong">
              <span className="font-mono uppercase">{applied.code}</span> applied
            </p>
            <p className="text-sm text-ink-muted">
              {formatCurrency(applied.discount)} off this order.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={handleRemove} disabled={disabled}>
          <X className="size-3.5" aria-hidden="true" />
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor="checkout-coupon"
        className="flex items-center gap-2 text-sm font-medium text-ink-strong"
      >
        <TicketPercent className="size-4 text-ink-muted" aria-hidden="true" />
        Have a coupon?
      </label>
      <div className="flex gap-2">
        <Input
          id="checkout-coupon"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleApply();
            }
          }}
          placeholder="WELCOME10"
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
          disabled={disabled || isValidating}
          aria-invalid={error ? true : undefined}
          className="h-10 font-mono uppercase"
        />
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => void handleApply()}
          disabled={disabled || isValidating || code.trim().length < 3}
        >
          {isValidating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Apply
        </Button>
      </div>

      {error ? (
        // The backend's own words — see the file header.
        <p role="alert" className="text-sm text-serious">
          {error}
        </p>
      ) : null}

      {preview && !applied ? (
        <p className="text-sm text-ink-muted">
          Applying {preview.code} — re-pricing your order…
        </p>
      ) : null}
    </div>
  );
}
