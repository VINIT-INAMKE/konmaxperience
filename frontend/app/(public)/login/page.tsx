'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { CustomerOtpForm } from '@/components/public/CustomerOtpForm';
import { useCart } from '@/hooks/use-cart';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

/** Where `?redirect=` may send someone. */
function safeRedirect(raw: string | null): string {
  if (!raw) return '/account';
  // Same-origin, path-only. `//evil.com` and `https://evil.com` are open
  // redirects; a login page is exactly where they get exploited.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/account';
  return raw;
}

/**
 * Customer sign-in.
 *
 * ## What changed
 *
 * The old page pushed everyone to `/menu` — a route Task 13 turns into a
 * redirect — and ignored `?redirect=` entirely, so an account guard could send
 * someone here and then strand them somewhere else. The destination is now the
 * `redirect` parameter, defaulting to `/account`.
 *
 * ## Why the merge runs in an effect and not in the callback
 *
 * `mergeGuestCart` is bound to the customer id `useCart` saw on its **last
 * render**. Calling it inside `onAuthenticated` — synchronously after
 * `verifyOtp` resolved — would run the closure from before the session existed,
 * see `customerId === null`, and no-op: the guest cart would be silently
 * dropped on every sign-in. Marking the sign-in and waiting for `isLoggedIn` to
 * become true is what makes the merge see a customer. The shared session store
 * is what makes that flag flip at all without a navigation.
 *
 * The merge never throws (`use-cart.ts`), and the redirect fires whether or not
 * it succeeded: a cart that failed to sync is still in `localStorage` and the
 * next explicit sync retries it, whereas a customer stuck on the login screen
 * after a successful sign-in has no way forward.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const target = safeRedirect(searchParams.get('redirect'));

  const { customer, isResolved, fetchProfile } = useCustomerAuth();
  const { isLoggedIn, mergeGuestCart } = useCart();

  const [authenticated, setAuthenticated] = useState(false);
  const leaving = useRef(false);
  const arrivalChecked = useRef(false);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  /**
   * Someone already signed in has no business on a login screen — but this is
   * checked **once**, at the moment the session first resolves.
   *
   * A standing `customer !== null → redirect` rule would fire mid-flow: a brand
   * new customer is signed in the instant `verifyOtp` returns, while
   * `CustomerOtpForm` is still on its "what should we call you?" step. The
   * one-shot ref keeps that step reachable.
   */
  useEffect(() => {
    if (!isResolved || arrivalChecked.current) return;
    arrivalChecked.current = true;
    if (authenticated || !customer || leaving.current) return;
    leaving.current = true;
    router.replace(target);
  }, [authenticated, isResolved, customer, router, target]);

  useEffect(() => {
    if (!authenticated || !isLoggedIn || leaving.current) return;
    leaving.current = true;
    void mergeGuestCart().finally(() => {
      router.replace(target);
    });
  }, [authenticated, isLoggedIn, mergeGuestCart, router, target]);

  const handleAuthenticated = useCallback(() => {
    setAuthenticated(true);
  }, []);

  if (authenticated) {
    return (
      <div
        className="flex flex-col items-center gap-3 py-16 text-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-5 animate-spin text-ink-muted" aria-hidden="true" />
        <p className="text-sm text-ink-muted">Signing you in…</p>
      </div>
    );
  }

  return (
    <>
      <CustomerOtpForm onAuthenticated={handleAuthenticated} />

      <div className="pt-6 text-center">
        <Link
          href="/team"
          className="text-xs text-ink-muted underline-offset-4 transition-colors hover:text-ink-strong hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
        >
          Staff? Go to team login →
        </Link>
      </div>
    </>
  );
}

export default function CustomerLoginPage() {
  return (
    <div className="mx-auto max-w-sm py-8">
      {/*
        `useSearchParams` opts the subtree into client-side rendering, and Next
        requires an explicit Suspense boundary for it rather than bailing the
        whole route out of static generation.
      */}
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-ink-muted" aria-hidden="true" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
