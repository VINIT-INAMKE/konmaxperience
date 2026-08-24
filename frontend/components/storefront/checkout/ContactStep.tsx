'use client';

import { useCallback } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { CustomerOtpForm } from '@/components/public/CustomerOtpForm';
import { Button } from '@/components/ui/button';
import type { Customer } from '@/lib/types/customer-auth';

/**
 * Step 1 — the login gate, **inline**.
 *
 * An anonymous visitor gets the OTP form here rather than a redirect to
 * `/login`, because a redirect at this point loses the cart: the guest cart
 * lives in `localStorage` and is merged into Redis only on sign-in, so bouncing
 * out of the checkout and back is the one navigation guaranteed to lose work
 * the customer already did.
 *
 * `CustomerOtpForm` and `OtpDigitInput` survive P5b deliberately — the phone →
 * WhatsApp OTP → optional name flow is unchanged, rate-limit messaging
 * included, so reusing them is both less code and less risk than a second
 * implementation of the same three phases.
 *
 * On success the parent merges the guest cart and advances. The merge itself
 * never throws (`useCart.mergeGuestCart`): a sign-in must not fail because
 * Redis blinked.
 */

export interface ContactStepProps {
  customer: Customer | null;
  isSessionLoading: boolean;
  /** `true` while the post-sign-in cart merge is in flight. */
  isMerging?: boolean;
  onAuthenticated: (customer: Customer) => void;
  onContinue: () => void;
}

export function ContactStep({
  customer,
  isSessionLoading,
  isMerging = false,
  onAuthenticated,
  onContinue,
}: ContactStepProps) {
  const handleAuthenticated = useCallback(
    (next: Customer) => onAuthenticated(next),
    [onAuthenticated],
  );

  if (isSessionLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-8 text-sm text-ink-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Checking your session…
      </div>
    );
  }

  if (!customer) {
    return (
      <section
        aria-labelledby="checkout-contact-heading"
        className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
      >
        <h2 id="checkout-contact-heading" className="sr-only">
          Sign in to continue
        </h2>
        <p className="mb-5 text-sm text-ink-muted">
          Your cart is saved. Sign in to place the order — we will not lose anything.
        </p>
        <CustomerOtpForm onAuthenticated={handleAuthenticated} />
      </section>
    );
  }

  const displayName = customer.name?.trim();

  return (
    <section
      aria-labelledby="checkout-contact-heading"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id="checkout-contact-heading" className="text-base font-semibold text-ink-strong">
        Contact
      </h2>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-leaf/25 bg-leaf/10 px-4 py-3">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-strong">
            {displayName ? `Signed in as ${displayName}` : 'Signed in'}
          </p>
          <p className="truncate text-sm text-ink-muted">+91 {customer.phone}</p>
          {customer.email ? (
            <p className="truncate text-sm text-ink-muted">{customer.email}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="button" size="lg" onClick={onContinue} disabled={isMerging}>
          {isMerging ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Syncing your cart…
            </>
          ) : (
            'Continue to fulfilment'
          )}
        </Button>
      </div>
    </section>
  );
}
