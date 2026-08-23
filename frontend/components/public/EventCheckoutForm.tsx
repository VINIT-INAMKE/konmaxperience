'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/api-client';
import { useRazorpay } from '@/hooks/use-razorpay';
import { useCustomerAuth } from '@/hooks/use-customer-auth';
import { PhoneLoginPrompt } from '@/components/public/PhoneLoginPrompt';
import { CustomerOtpForm } from '@/components/public/CustomerOtpForm';
import { CustomerIdentityStrip } from '@/components/public/CustomerIdentityStrip';
import { PaymentStatusPanel } from '@/components/public/PaymentStatusPanel';
import type { Customer, CheckoutResponse } from '@/lib/types/customer-auth';

interface EventCheckoutFormProps {
  eventId: string;
  eventDate: string;
  eventPrice: number;
  eventTitle: string;
  spotsRemaining: number;
  onBooked: () => void;
}

type CheckoutPhase =
  | 'checking'
  | 'not-logged-in'
  | 'login-form'
  | 'ready'
  | 'submitting'
  | 'success'
  | 'failed'
  | 'refunded';

export function EventCheckoutForm({
  eventId,
  eventDate,
  eventPrice,
  eventTitle,
  spotsRemaining,
  onBooked,
}: EventCheckoutFormProps) {
  const { customer, isLoading, fetchProfile, logout } = useCustomerAuth();
  const [phase, setPhase] = useState<CheckoutPhase>('checking');
  const [guests, setGuests] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState<number | undefined>();

  const isFree = eventPrice === 0;
  const total = eventPrice * guests;

  const handlePaymentSuccess = useCallback(
    async (response: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }) => {
      try {
        await apiClient.post(`/events/${eventId}/bookings/confirm`, {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          guests,
          customer_name: customer?.name || undefined,
        });
        setPhase('success');
        onBooked();
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.message.toLowerCase().includes('full') ||
            err.message.toLowerCase().includes('refund'))
        ) {
          setRefundAmount(total);
          setPhase('refunded');
        } else {
          setPhase('failed');
          setError("Payment didn't go through — try again or use a different method.");
        }
      }
    },
    [eventId, guests, customer, total, onBooked],
  );

  const { state: rzpState, openCheckout, reset: resetRzp } = useRazorpay({
    onSuccess: handlePaymentSuccess,
    onDismiss: () => {
      setPhase('ready');
      setError('Payment cancelled — try again when you\'re ready.');
    },
    onFailed: () => {
      setPhase('failed');
      setError("Payment didn't go through — try again or use a different method.");
    },
  });

  // On mount, check if customer is already logged in
  useEffect(() => {
    void fetchProfile().then((profile) => {
      if (profile) {
        setPhase('ready');
      } else {
        setPhase('not-logged-in');
      }
    });
  }, [fetchProfile]);

  const handleAuthenticated = useCallback((c: Customer) => {
    setPhase('ready');
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setPhase('not-logged-in');
  }, [logout]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setPhase('submitting');

    try {
      const result = await apiClient.post<CheckoutResponse>(
        `/events/${eventId}/checkout`,
        { guests },
      );

      if (result.type === 'free') {
        setPhase('success');
        onBooked();
        return;
      }

      // Paid event — open Razorpay
      if (result.razorpay_order_id) {
        await openCheckout({
          razorpayOrderId: result.razorpay_order_id,
          description: `Event Booking: ${eventTitle}`,
          prefill: {
            name: customer?.name || undefined,
            contact: customer ? `+91${customer.phone}` : undefined,
            email: customer?.email || undefined,
          },
        });
      }
    } catch (err) {
      setPhase('ready');
      if (err instanceof ApiError && err.status === 400) {
        setError('This event just sold out — no spots left.');
      } else {
        setError('Something went wrong — check your connection and try again');
      }
    }
  }, [eventId, guests, onBooked, openCheckout, eventTitle, customer]);

  const handleRetry = useCallback(() => {
    setPhase('ready');
    setError(null);
    resetRzp();
  }, [resetRzp]);

  const handleDecrement = () => setGuests((prev) => Math.max(1, prev - 1));
  const handleIncrement = () => setGuests((prev) => Math.min(spotsRemaining, prev + 1));

  // Loading state
  if (phase === 'checking' || isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-[var(--public-muted)]" />
      </div>
    );
  }

  // Success
  if (phase === 'success') {
    return <PaymentStatusPanel status="success" eventDate={eventDate} />;
  }

  // Refunded (capacity race condition)
  if (phase === 'refunded') {
    return <PaymentStatusPanel status="refunded" refundAmount={refundAmount} />;
  }

  // Failed
  if (phase === 'failed') {
    return <PaymentStatusPanel status="failed" onRetry={handleRetry} />;
  }

  // Not logged in — show prompt
  if (phase === 'not-logged-in') {
    return <PhoneLoginPrompt onLoginClick={() => setPhase('login-form')} />;
  }

  // OTP login form
  if (phase === 'login-form') {
    return (
      <CustomerOtpForm
        onAuthenticated={handleAuthenticated}
        onCancel={() => setPhase('not-logged-in')}
      />
    );
  }

  // Sold out
  if (spotsRemaining <= 0) {
    return (
      <div className="rounded-lg border bg-muted p-6 text-center">
        <p className="text-base text-muted-foreground">This event is sold out</p>
      </div>
    );
  }

  // Ready — show booking form
  const isSubmitting = phase === 'submitting' || rzpState === 'loading-script' || rzpState === 'creating-order';
  const isRazorpayOpen = rzpState === 'razorpay-open';

  let ctaLabel = isFree ? 'Reserve My Spot' : `Book & Pay \u20B9${total}`;
  if (isSubmitting) ctaLabel = 'Preparing payment...';
  if (isRazorpayOpen) ctaLabel = 'Payment in progress...';

  return (
    <div className="space-y-4">
      {customer && (
        <CustomerIdentityStrip
          customer={customer}
          onLogout={() => void handleLogout()}
        />
      )}

      {/* Guest stepper */}
      <div className="space-y-2">
        <label className="text-sm text-[var(--public-fg)]">Guests</label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Remove guest"
            className="min-h-[44px] min-w-[44px]"
            onClick={handleDecrement}
            disabled={guests <= 1 || isSubmitting || isRazorpayOpen}
          >
            <Minus className="size-4" />
          </Button>
          <Input
            type="number"
            min={1}
            max={spotsRemaining}
            value={guests}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1 && val <= spotsRemaining) {
                setGuests(val);
              }
            }}
            disabled={isSubmitting || isRazorpayOpen}
            className="w-20 text-center bg-white border-[var(--public-border)] text-[var(--public-fg)]"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Add guest"
            className="min-h-[44px] min-w-[44px]"
            onClick={handleIncrement}
            disabled={guests >= spotsRemaining || isSubmitting || isRazorpayOpen}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* CTA */}
      <Button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={isSubmitting || isRazorpayOpen}
        className="w-full h-11 rounded-lg bg-[var(--public-terracotta)] text-white hover:bg-[var(--public-terracotta)]/90 disabled:opacity-50"
      >
        {(isSubmitting || isRazorpayOpen) && (
          <Loader2 className="size-4 animate-spin mr-2" />
        )}
        {ctaLabel}
      </Button>

      {/* Payment state indicator */}
      {(isSubmitting || isRazorpayOpen) && (
        <div role="status" className="text-center">
          <p className="text-sm text-[var(--public-muted)]">
            {isSubmitting ? 'Preparing payment...' : 'Payment in progress...'}
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--status-serious)]/25 bg-[var(--status-serious)]/10 px-4 py-3 text-sm text-[var(--status-serious)]"
        >
          {error}
        </div>
      )}
    </div>
  );
}
