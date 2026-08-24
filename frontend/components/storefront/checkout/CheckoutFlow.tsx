'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { CheckoutStepper, stepIndex, type CheckoutStep } from '@/components/storefront/checkout/CheckoutStepper';
import { ContactStep } from '@/components/storefront/checkout/ContactStep';
import { FulfilmentStep } from '@/components/storefront/checkout/FulfilmentStep';
import { PayButton, type PayBanner } from '@/components/storefront/checkout/PayButton';
import { QuoteCountdown } from '@/components/storefront/checkout/QuoteCountdown';
import { QuoteErrorBanner } from '@/components/storefront/checkout/QuoteErrorBanner';
import { QuoteSummary } from '@/components/storefront/checkout/QuoteSummary';
import { ReviewStep } from '@/components/storefront/checkout/ReviewStep';
import { useCheckoutAddresses } from '@/components/storefront/checkout/use-checkout-addresses';
import { useServiceability } from '@/components/storefront/checkout/use-serviceability';
import { useCart } from '@/hooks/use-cart';
import { useQuote } from '@/lib/hooks/use-quote';
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format/currency';
import type { CheckoutChannel, LoyaltySummary, QuoteRequest } from '@/lib/types/checkout';

/**
 * `/checkout` — the money path (`STORE-02`).
 *
 * ## One quote per review step
 *
 * This is the load-bearing UX decision of P5b (decision 3). A quote is not a
 * price preview: `POST /customer/checkout/quote` writes a frozen price into
 * Redis, creates a 15-minute `held` `EventBooking` for **every** experience line
 * and burns a coupon validation. Issuing one per keystroke would churn holds,
 * block other customers out of experiences nobody is buying, and mislead this
 * one about what they are agreeing to.
 *
 * So the flow is three steps — **Contact → Fulfilment → Review** — and the quote
 * is issued on entering *Review*, then re-issued only when one of its five
 * inputs genuinely changes: channel, address, pickup, coupon, points.
 * `useQuote` derives its request from those primitives, so a re-render or a new
 * object identity for the same intentions produces no request at all.
 *
 * ## The countdown is the containment for P5a risk 5
 *
 * A payment captured after its booking hold was swept is the failure this
 * screen exists to prevent. `expires_at` drives one interval; under three
 * minutes it turns warning-toned; at zero Pay disables and the only way forward
 * is "Refresh price", which issues a new quote with new holds.
 *
 * ## Error paths
 *
 * | where | status | behaviour |
 * |---|---|---|
 * | quote | `400` | the server's message verbatim, controls stay on screen |
 * | quote | `503` | Redis is down — a retry, not the customer's fault |
 * | pay | `410` | silent re-quote in place, informational banner |
 * | pay | `404` | toast and back to `/cart` |
 * | pay | `400` | the server's message verbatim, then a re-quote |
 *
 * ## Why the cart is force-synced before the first quote
 *
 * The quote reads the cart from **Redis**, not from the request — so the
 * channel this screen just chose has to be there before the quote is asked for.
 * "Continue to review" therefore awaits `cart.sync()` rather than relying on
 * the 400 ms debounce landing in time.
 */
export function CheckoutFlow() {
  const cart = useStorefrontCart({ syncOnMount: true });
  const { customer, mergeGuestCart } = useCart();

  const [step, setStep] = useState<CheckoutStep>('contact');
  const [furthest, setFurthest] = useState<CheckoutStep>('contact');
  const [channel, setChannelState] = useState<CheckoutChannel>('delivery');
  const [pickup, setPickup] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [activePincode, setActivePincode] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [banner, setBanner] = useState<PayBanner | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [loyaltySummary, setLoyaltySummary] = useState<LoyaltySummary | null>(null);

  const isLoggedIn = cart.isLoggedIn;
  const addresses = useCheckoutAddresses(isLoggedIn);

  const hasLocal = cart.groups.local.length > 0;
  const hasShipped = cart.groups.shipped.length > 0;
  const hasBooking = cart.groups.booking.length > 0;

  // ── seeding from the cart ────────────────────────────────────────────────
  // The cart already knows the channel `/cart` was priced on; adopt it once,
  // then let this screen own it so a background sync cannot move the toggle
  // under the customer's hand.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !cart.isHydrated) return;
    seeded.current = true;
    const initial = cart.channel ?? 'delivery';
    setChannelState(initial);
    setPickup(initial === 'takeaway');
  }, [cart.isHydrated, cart.channel]);

  // Pick the default address (or the only one) so the common case needs no click.
  useEffect(() => {
    if (selectedAddressId || addresses.addresses.length === 0) return;
    const preferred =
      addresses.addresses.find((a) => a.is_default) ?? addresses.addresses[0];
    setSelectedAddressId(preferred.id);
  }, [addresses.addresses, selectedAddressId]);

  // A signed-out visitor can only be on step 1 — the address list, the quote and
  // the payment all need a session.
  useEffect(() => {
    if (!isLoggedIn && !cart.isSessionLoading && step !== 'contact') {
      setStep('contact');
      setFurthest('contact');
    }
  }, [isLoggedIn, cart.isSessionLoading, step]);

  // Balance and tier for the loyalty panel *before* the first quote lands. The
  // redeemable **cap** never comes from here — only a quote knows the
  // discounted subtotal `max_redeem_percent` is a percentage of.
  useEffect(() => {
    if (!isLoggedIn) {
      setLoyaltySummary(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const summary = await apiClient.get<LoyaltySummary>('/customer/loyalty');
        if (!cancelled) setLoyaltySummary(summary);
      } catch {
        // A missing loyalty panel must never block a checkout.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  // ── serviceability, before any quote exists ──────────────────────────────
  const serviceability = useServiceability({
    pincode: activePincode,
    channel,
    enabled: step === 'fulfilment' && isLoggedIn && (hasLocal || hasShipped),
  });

  // ── the quote ────────────────────────────────────────────────────────────
  const quoteInput = useMemo<QuoteRequest | null>(() => {
    if (step !== 'review') return null;
    const next: QuoteRequest = { channel };
    if (selectedAddressId) next.delivery_address_id = selectedAddressId;
    if (pickup) next.pickup = true;
    if (couponCode) next.coupon_code = couponCode;
    if (redeemPoints > 0) next.redeem_points = redeemPoints;
    return next;
  }, [step, channel, selectedAddressId, pickup, couponCode, redeemPoints]);

  const {
    quote,
    isLoading: isQuoting,
    error: quoteError,
    errorStatus: quoteErrorStatus,
    msLeft,
    isExpired,
    isExpiring,
    refresh,
  } = useQuote({
    input: quoteInput,
    enabled: isLoggedIn && cart.canCheckout,
  });

  // A fresh quote supersedes whatever the last attempt had to say.
  const lastQuoteId = useRef<string | null>(null);
  useEffect(() => {
    if (quote && quote.quote_id !== lastQuoteId.current) {
      lastQuoteId.current = quote.quote_id;
      setBanner(null);
    }
  }, [quote]);

  // ── handlers ─────────────────────────────────────────────────────────────
  const handleFulfilmentChange = useCallback(
    (next: { pickup: boolean; channel: CheckoutChannel }) => {
      setPickup(next.pickup);
      setChannelState(next.channel);
      // Keep the stored cart's channel in step so its prices and the quote's agree.
      cart.setChannel(next.channel);
    },
    [cart],
  );

  const handleAuthenticated = useCallback(async () => {
    setIsMerging(true);
    try {
      // Never throws — a sign-in must not fail because Redis blinked.
      await mergeGuestCart();
      await addresses.reload();
    } finally {
      setIsMerging(false);
    }
    setStep('fulfilment');
    setFurthest((prev) => (stepIndex(prev) < stepIndex('fulfilment') ? 'fulfilment' : prev));
  }, [addresses, mergeGuestCart]);

  const handleContinueToFulfilment = useCallback(() => {
    setStep('fulfilment');
    setFurthest((prev) => (stepIndex(prev) < stepIndex('fulfilment') ? 'fulfilment' : prev));
  }, []);

  const handleContinueToReview = useCallback(async () => {
    setIsContinuing(true);
    try {
      // The quote reads the cart from Redis — push it before asking for a price.
      await cart.sync();
    } finally {
      setIsContinuing(false);
    }
    setStep('review');
    setFurthest('review');
  }, [cart]);

  const handleApplyCoupon = useCallback((code: string) => {
    setBanner(null);
    setCouponCode(code);
  }, []);

  const handleRemoveCoupon = useCallback(() => {
    setBanner(null);
    setCouponCode(null);
  }, []);

  const handleRequote = useCallback(() => refresh(), [refresh]);

  // ── gates ────────────────────────────────────────────────────────────────
  if (!cart.isHydrated) {
    return <StorefrontSkeleton variant="list" count={3} />;
  }

  // A confirmed order clears the cart before the redirect lands, so an existing
  // quote keeps the page from flashing "your cart is empty" on the way out.
  if (cart.lines.length === 0 && !quote) {
    return (
      <StorefrontEmpty
        title="Your cart is empty"
        description="Add something you like and come back — your cart is saved while you browse."
        action={{ label: 'Browse the shop', href: '/shop' }}
        secondaryAction={{ label: 'See experiences', href: '/experiences' }}
      />
    );
  }

  if (cart.unavailable.length > 0) {
    return (
      <div className="rounded-2xl border border-warning/25 bg-warning/10 px-6 py-10 text-center">
        <AlertTriangle className="mx-auto size-6 text-warning" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-ink-strong">
          Your cart needs a moment
        </h1>
        <p className="mx-auto mt-1.5 max-w-prose text-sm text-ink-muted">
          {cart.blockedReason ?? 'Some items are no longer available.'}
        </p>
        <div className="mt-5">
          <Button size="lg" nativeButton={false} render={<Link href="/cart" />}>
            Back to your cart
          </Button>
        </div>
      </div>
    );
  }

  const summary = quote ? (
    <QuoteSummary
      quote={quote}
      header={
        <QuoteCountdown msLeft={msLeft} isExpiring={isExpiring} isExpired={isExpired} />
      }
      footer={
        <PayButton
          quote={quote}
          customer={customer}
          isExpired={isExpired}
          onRequote={handleRequote}
          onBanner={setBanner}
          disabled={isQuoting}
        />
      }
    />
  ) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink-strong sm:text-3xl">Checkout</h1>
        <p className="text-sm text-ink-muted">
          Three short steps. Your price is held for 15 minutes once you reach the last one.
        </p>
      </header>

      <CheckoutStepper
        current={step}
        furthest={furthest}
        onNavigate={(next) => {
          setStep(next);
          // Stepping back off Review drops the quote (`input` becomes `null`),
          // which is correct: a price nobody is looking at should not hold
          // experience bookings hostage.
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6">
          {step === 'contact' ? (
            <ContactStep
              customer={customer}
              isSessionLoading={cart.isSessionLoading}
              isMerging={isMerging}
              onAuthenticated={() => void handleAuthenticated()}
              onContinue={handleContinueToFulfilment}
            />
          ) : null}

          {step === 'fulfilment' ? (
            <FulfilmentStep
              hasLocal={hasLocal}
              hasShipped={hasShipped}
              hasBooking={hasBooking}
              pickup={pickup}
              onFulfilmentChange={handleFulfilmentChange}
              addresses={addresses.addresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              onCreateAddress={addresses.create}
              onActivePincodeChange={setActivePincode}
              isLoadingAddresses={addresses.isLoading}
              isSavingAddress={addresses.isSaving}
              addressError={addresses.error}
              serviceability={serviceability.result}
              isCheckingServiceability={serviceability.isLoading}
              serviceabilityError={serviceability.error}
              onBack={() => setStep('contact')}
              onContinue={() => void handleContinueToReview()}
              isContinuing={isContinuing}
            />
          ) : null}

          {step === 'review' ? (
            <>
              {isExpired ? (
                <QuoteErrorBanner
                  tone="expired"
                  message="Your price and any experience holds have lapsed. Refresh to get a fresh price — the items in your cart are untouched."
                  onRefresh={handleRequote}
                  isRefreshing={isQuoting}
                />
              ) : banner ? (
                <QuoteErrorBanner
                  tone={banner.tone}
                  message={banner.message}
                  onRefresh={banner.tone === 'error' ? undefined : handleRequote}
                  isRefreshing={isQuoting}
                />
              ) : null}

              <ReviewStep
                quote={quote}
                isLoading={isQuoting}
                error={quoteError}
                errorStatus={quoteErrorStatus}
                onRetry={handleRequote}
                channel={channel}
                couponCode={couponCode}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={handleRemoveCoupon}
                redeemPoints={redeemPoints}
                onRedeemChange={setRedeemPoints}
                loyaltyFallback={loyaltySummary}
                onBack={() => setStep('fulfilment')}
              />

              {/* Below `lg` the summary is a block in the flow, and the bar below
                  is what stays reachable. */}
              <div className="lg:hidden">{summary}</div>
            </>
          ) : null}
        </div>

        {/* Desktop: the price travels with the customer down the page. */}
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          {summary ?? (
            <div className="rounded-2xl border border-dashed border-line-warm bg-surface/60 p-5">
              <p className="text-sm font-medium text-ink-strong">Your price</p>
              <p className="mt-1.5 text-sm text-ink-muted">
                We hold a final price — with shipping, any coupon and your points — for 15
                minutes once you reach the review step.
              </p>
              <p className="mt-3 text-sm text-ink-subtle tabular-nums">
                {cart.count} {cart.count === 1 ? 'item' : 'items'} ·{' '}
                {formatCurrency(cart.subtotal)}
                <span className="block text-xs text-ink-faint">
                  Subtotal so far, GST included.
                </span>
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile: total and Pay stay in reach without scrolling back. */}
      {step === 'review' && quote ? (
        <div className="sticky bottom-0 -mx-4 border-t border-line bg-surface px-4 py-3 shadow-lg sm:-mx-6 sm:px-6 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-muted">Total</p>
              <p className="text-lg font-semibold text-ink-strong tabular-nums">
                {formatCurrency(quote.total)}
              </p>
            </div>
            <QuoteCountdown
              msLeft={msLeft}
              isExpiring={isExpiring}
              isExpired={isExpired}
              className="shrink-0"
            />
          </div>
          <div className="mt-2">
            <PayButton
              quote={quote}
              customer={customer}
              isExpired={isExpired}
              onRequote={handleRequote}
              onBanner={setBanner}
              disabled={isQuoting}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
