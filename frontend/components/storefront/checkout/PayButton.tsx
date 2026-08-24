'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import { useRazorpay } from '@/hooks/use-razorpay';
import { apiErrorMessage } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format/currency';
import type { Quote } from '@/lib/types/checkout';
import type { Customer } from '@/lib/types/customer-auth';
import { cn } from '@/lib/utils';
import type { QuoteBannerTone } from '@/components/storefront/checkout/QuoteErrorBanner';

/**
 * `create order → Razorpay → confirm`, and the four ways it can go sideways.
 *
 * ## The three failures of `POST /customer/orders` are three different events
 *
 * P5a split them deliberately and `useCart.createOrder` returns a typed outcome
 * rather than throwing a string, so this component branches instead of guessing
 * (P5b decision 4):
 *
 * | outcome | status | what happens here |
 * |---|---|---|
 * | `'requote'` | `410` | the quote outlived its `expires_at`; re-quote **in place**, informational banner, stay on the page |
 * | `'restart'` | `404` | the quote is gone entirely — never issued, already spent, TTL reaped; toast and bounce to `/cart` |
 * | `'stale'` | `400` | the price moved or a line vanished; show the **server's message verbatim** and re-quote |
 * | `'error'` | other | a fault, retryable, with the status kept so a `503` reads as "retry" |
 *
 * ## The idempotency key is per attempt-set, not per tap
 *
 * One key per `quote_id`, minted lazily and held in a ref. A double-tapped Pay
 * button, or a retry after a dismissed modal, resolves to the **same** Razorpay
 * order rather than a second one — which is the entire purpose of the field. A
 * re-quote produces a new `quote_id` and therefore a new key, because that is a
 * genuinely new attempt at a different price.
 *
 * ## `key_id` from the response wins
 *
 * The server that opened the Razorpay order is the authority on which merchant
 * account it belongs to. `NEXT_PUBLIC_RAZORPAY_KEY_ID` is only the fallback, and
 * when neither exists the modal is **not** opened — a Razorpay checkout with an
 * empty key fails at signature verification after the customer has already been
 * charged nothing but has been told it worked.
 *
 * ## A dismissed modal loses nothing
 *
 * `ondismiss` returns the button to "Pay ₹x". The quote is untouched, the
 * countdown keeps running on its own interval, and the same idempotency key is
 * reused on the next tap.
 */

export interface PayBanner {
  tone: QuoteBannerTone;
  message: string;
}

export interface PayButtonProps {
  quote: Quote;
  customer: Customer | null;
  /** `true` once the quote's 15-minute window has closed. */
  isExpired: boolean;
  /** `useQuote().refresh` — re-issues the quote with the current inputs. */
  onRequote: () => Promise<Quote | null>;
  onBanner: (banner: PayBanner | null) => void;
  /** Blocked for a reason outside this component (an unavailable line, a re-quote in flight). */
  disabled?: boolean;
  className?: string;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // The DTO wants 8–64 characters; this is ~19 and unique enough for a retry set.
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

type PayPhase = 'idle' | 'creating' | 'open' | 'confirming' | 'confirm-failed';

export function PayButton({
  quote,
  customer,
  isExpired,
  onRequote,
  onBanner,
  disabled = false,
  className,
}: PayButtonProps) {
  const router = useRouter();
  const { createOrder, confirmOrder } = useCart();
  const [phase, setPhase] = useState<PayPhase>('idle');

  /** One key per quote — see the header. */
  const keyRef = useRef<{ quoteId: string; key: string } | null>(null);
  const idempotencyKeyFor = useCallback((quoteId: string): string => {
    if (keyRef.current?.quoteId !== quoteId) {
      keyRef.current = { quoteId, key: newIdempotencyKey() };
    }
    return keyRef.current.key;
  }, []);

  /** Kept so a failed confirm can be retried without re-paying — confirm is idempotent. */
  const lastPayment = useRef<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  } | null>(null);

  const finishConfirm = useCallback(
    async (payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      lastPayment.current = payload;
      setPhase('confirming');
      onBanner(null);
      try {
        // A replay of the same payload returns the *same* order, not an error,
        // so a retried confirm is always safe.
        const order = await confirmOrder(payload);
        router.push(`/orders/${order.id}/track?placed=1`);
      } catch (caught) {
        setPhase('confirm-failed');
        onBanner({
          tone: 'error',
          message: apiErrorMessage(
            caught,
            'Your payment went through but we could not finish the order. Tap retry — you will not be charged twice.',
          ),
        });
        // Let `useRazorpay` move to its `failed` state rather than `success`.
        throw caught;
      }
    },
    [confirmOrder, onBanner, router],
  );

  const razorpay = useRazorpay({
    onSuccess: finishConfirm,
    onDismiss: () => {
      // The quote is untouched and the countdown is still running.
      setPhase('idle');
    },
    onFailed: (response) => {
      setPhase('idle');
      onBanner({
        tone: 'error',
        message:
          response?.error?.description ??
          'The payment did not go through. Nothing has been charged — please try again.',
      });
    },
  });

  const { openCheckout, reset: resetRazorpay } = razorpay;

  const handlePay = useCallback(async () => {
    if (isExpired || disabled) return;
    setPhase('creating');
    onBanner(null);

    const result = await createOrder(quote.quote_id, idempotencyKeyFor(quote.quote_id));

    if (result.outcome === 'requote') {
      // 410 — the quote outlived its window. Refresh silently and stay put.
      setPhase('idle');
      onBanner({ tone: 'info', message: result.message });
      await onRequote();
      return;
    }

    if (result.outcome === 'restart') {
      // 404 — there is nothing left to pay for. Back to the cart.
      setPhase('idle');
      toast.error(result.message);
      router.push('/cart');
      return;
    }

    if (result.outcome === 'stale') {
      // 400 — the cart moved. The server's words, then a fresh price.
      setPhase('idle');
      onBanner({ tone: 'warning', message: result.message });
      await onRequote();
      return;
    }

    if (result.outcome === 'error') {
      setPhase('idle');
      onBanner({ tone: 'error', message: result.message });
      return;
    }

    const order = result.order;
    // The response's key is authoritative; the env var is only a fallback.
    const razorpayKey = order.key_id ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null;
    if (!razorpayKey) {
      setPhase('idle');
      onBanner({
        tone: 'error',
        message:
          'Online payment is not configured right now, so we have not taken any money. Please contact us to complete this order.',
      });
      return;
    }

    setPhase('open');
    resetRazorpay();
    await openCheckout({
      razorpayOrderId: order.razorpay_order_id,
      key: razorpayKey,
      description: `Konma order · ${formatCurrency(quote.total)}`,
      prefill: {
        name: customer?.name ?? undefined,
        contact: customer?.phone ?? undefined,
        email: customer?.email ?? undefined,
      },
    });
  }, [
    createOrder,
    customer,
    disabled,
    idempotencyKeyFor,
    isExpired,
    onBanner,
    onRequote,
    openCheckout,
    quote.quote_id,
    quote.total,
    resetRazorpay,
    router,
  ]);

  const retryConfirm = useCallback(async () => {
    const payload = lastPayment.current;
    if (!payload) return;
    try {
      await finishConfirm(payload);
    } catch {
      // `finishConfirm` has already set the phase and the banner.
    }
  }, [finishConfirm]);

  if (phase === 'confirm-failed') {
    return (
      <Button
        type="button"
        size="lg"
        className={cn('w-full', className)}
        onClick={() => void retryConfirm()}
      >
        <RotateCw className="size-4" aria-hidden="true" />
        Retry finishing your order
      </Button>
    );
  }

  const busy = phase === 'creating' || phase === 'open' || phase === 'confirming';
  const label =
    phase === 'creating'
      ? 'Starting payment…'
      : phase === 'open'
        ? 'Waiting for payment…'
        : phase === 'confirming'
          ? 'Confirming your order…'
          : isExpired
            ? 'Refresh the price to pay'
            : `Pay ${formatCurrency(quote.total)}`;

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={disabled || isExpired || busy}
        onClick={() => void handlePay()}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Lock className="size-4" aria-hidden="true" />
        )}
        {label}
      </Button>
      <p className="text-center text-xs text-ink-faint">
        Secured by Razorpay. Your card details never reach us.
      </p>
    </div>
  );
}
