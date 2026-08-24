'use client';

import { ArrowLeft, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { CouponField } from '@/components/storefront/checkout/CouponField';
import { LoyaltySlider } from '@/components/storefront/checkout/LoyaltySlider';
import { QuoteErrorBanner } from '@/components/storefront/checkout/QuoteErrorBanner';
import type { CheckoutChannel, LoyaltySummary, Quote, QuoteLoyalty } from '@/lib/types/checkout';
import { cn } from '@/lib/utils';

/**
 * Step 3 — the two controls that change a price, and the price itself.
 *
 * `QuoteSummary` deliberately does **not** live here: on desktop it is the
 * sticky right column and below `lg` it is the bottom bar, so `CheckoutFlow`
 * owns its placement and this step owns only the inputs. That is why entering
 * this step is what issues the quote — both surfaces read the same one object.
 *
 * ## A failed quote does not hide the controls
 *
 * The most common `400` here is a coupon the customer just typed
 * (`This coupon has expired`, `Add ₹150.00 more to use this coupon`). Replacing
 * the step with a generic error page would strand them: the message is shown
 * verbatim in a banner with a way to drop the code, and the coupon and loyalty
 * controls stay on screen so the customer can act on what they were told.
 *
 * Before the first quote lands, the loyalty panel falls back to
 * `GET /customer/loyalty` so a customer sees their balance and tier rather than
 * an empty box — but the **cap** always comes from the quote, because only the
 * quote knows the discounted subtotal `max_redeem_percent` applies to.
 */

export interface ReviewStepProps {
  quote: Quote | null;
  isLoading: boolean;
  /** The server's message from a failed quote, verbatim. */
  error: string | null;
  errorStatus: number | null;
  onRetry: () => void;

  channel: CheckoutChannel;
  /** The code the customer asked for — set even when the quote then rejected it. */
  couponCode: string | null;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;

  redeemPoints: number;
  onRedeemChange: (points: number) => void;
  /** `GET /customer/loyalty`, for the panel before the first quote lands. */
  loyaltyFallback: LoyaltySummary | null;

  onBack: () => void;
  className?: string;
}

/** Shapes `GET /customer/loyalty` into the quote's loyalty block, with a zero cap. */
function fallbackLoyalty(summary: LoyaltySummary): QuoteLoyalty {
  return {
    balance: summary.points_balance,
    tier: summary.tier,
    // Only a quote knows the discounted subtotal the cap is a percentage of, so
    // the fallback panel shows the balance and refuses to guess at the cap.
    max_redeemable_points: 0,
    points_applied: 0,
    redeem_amount: 0,
    redeem_value_per_point: summary.redeem_value_per_point,
    points_earned_estimate: 0,
  };
}

export function ReviewStep({
  quote,
  isLoading,
  error,
  errorStatus,
  onRetry,
  channel,
  couponCode,
  onApplyCoupon,
  onRemoveCoupon,
  redeemPoints,
  onRedeemChange,
  loyaltyFallback,
  onBack,
  className,
}: ReviewStepProps) {
  const loyalty = quote?.loyalty ?? (loyaltyFallback ? fallbackLoyalty(loyaltyFallback) : null);

  return (
    <section
      aria-labelledby="checkout-review-heading"
      className={cn('rounded-2xl border border-line bg-surface p-5 sm:p-6', className)}
    >
      <h2 id="checkout-review-heading" className="text-base font-semibold text-ink-strong">
        Review and pay
      </h2>

      {error ? (
        <QuoteErrorBanner
          className="mt-4"
          // A 503 is Redis being down — retryable, not something the customer did.
          tone={errorStatus === 503 ? 'error' : 'warning'}
          title={
            errorStatus === 503
              ? 'We could not price your cart'
              : couponCode
                ? 'That coupon was not applied'
                : 'We could not price your cart'
          }
          message={error}
          onRefresh={onRetry}
          refreshLabel="Try again"
          isRefreshing={isLoading}
        />
      ) : null}

      <div className="mt-5 space-y-5">
        {/* A rejected code still needs a way out, and the quote has no `coupon`
            to render — so the pending code gets its own affordance. */}
        {error && couponCode && !quote?.coupon ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3">
            <p className="text-sm text-ink-subtle">
              Trying <span className="font-mono font-medium uppercase text-ink">{couponCode}</span>
            </p>
            <Button type="button" size="sm" variant="ghost" onClick={onRemoveCoupon}>
              <X className="size-3.5" aria-hidden="true" />
              Remove coupon
            </Button>
          </div>
        ) : null}

        <CouponField
          applied={quote?.coupon ?? null}
          channel={channel}
          onApply={onApplyCoupon}
          onRemove={onRemoveCoupon}
          disabled={isLoading}
        />

        {loyalty ? (
          <LoyaltySlider
            loyalty={loyalty}
            points={redeemPoints}
            onChange={onRedeemChange}
            disabled={isLoading || !quote}
          />
        ) : null}

        {isLoading && !quote ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Pricing your order…
            </p>
            <StorefrontSkeleton variant="list" count={2} />
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to fulfilment
        </Button>
      </div>
    </section>
  );
}
