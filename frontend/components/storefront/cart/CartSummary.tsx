'use client';

/**
 * The cart's money panel — and the one component in the storefront that is
 * defined as much by what it refuses to render as by what it renders.
 *
 * **There is no grand total here** (P5b decision 6, signed off). Shipping,
 * coupon discount and loyalty exist only inside a quote, and
 * `POST /customer/checkout/quote` needs a channel and an address before it will
 * produce one. A "Total" on this page would therefore be either a lie (the
 * subtotal wearing a total's label) or a demand for the customer's address
 * before they have decided to buy. So the panel shows the two figures that are
 * genuinely known — the server's tax-inclusive subtotal and the GST already
 * carved out of it — and says plainly where the rest is worked out.
 *
 * **GST is never a `+` line** (P5a decision 1). `totals.tax_total` is contained
 * in `totals.subtotal`; `<MoneyLine variant="of-which">` is the only shape this
 * codebase will give it, which is what makes the mistake hard to make.
 *
 * The primary action has exactly three states and each one says why:
 * signed out → sign in; blocked → disabled with `blockedReason` printed beside
 * it; otherwise → `/checkout`.
 */

import Link from 'next/link';
import { Info, LogIn, RefreshCw } from 'lucide-react';

import { MoneyLine } from '@/components/storefront/common/MoneyLine';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface CartSummaryProps {
  /** Units, not lines — "4 items" reads better than "2 lines". */
  itemCount: number;
  /** `totals.subtotal` once synced, the local optimistic sum before that. */
  subtotal: number;
  /** GST carved out of `subtotal`. `null` until a sync has landed. */
  taxTotal: number | null;
  /** `true` once the server's prices have replaced the local ones. */
  isServerPriced: boolean;
  isSyncing?: boolean;
  isLoggedIn: boolean;
  isSessionLoading?: boolean;
  canCheckout: boolean;
  /** Written for the customer; printed beside the disabled button. */
  blockedReason: string | null;
  /** The server's message from the last failed sync, verbatim. */
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function CartSummary({
  itemCount,
  subtotal,
  taxTotal,
  isServerPriced,
  isSyncing = false,
  isLoggedIn,
  isSessionLoading = false,
  canCheckout,
  blockedReason,
  error,
  onRetry,
  className,
}: CartSummaryProps) {
  return (
    <aside
      data-slot="cart-summary"
      aria-label="Order summary"
      className={cn(
        'rounded-2xl border border-line bg-surface p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-strong">Summary</h2>
        <span className="text-xs tabular-nums text-ink-faint">
          {itemCount} item{itemCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <MoneyLine
          label="Subtotal (incl. GST)"
          value={subtotal}
          note={
            isServerPriced
              ? undefined
              : isLoggedIn
                ? 'Confirming with the server…'
                : 'Your saved prices — confirmed when you sign in'
          }
        />
        {taxTotal !== null ? <MoneyLine label="GST" value={taxTotal} variant="of-which" /> : null}
      </div>

      {/*
        The one honest thing a cart can say about the rest of the money.
        Removing this line is what turns "Subtotal" into an implied total.
      */}
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-raised px-3 py-2 text-xs text-ink-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>Shipping, coupons and loyalty are calculated at checkout.</span>
      </p>

      {error ? (
        <div
          role="status"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-critical/40 bg-critical/5 px-3 py-2"
        >
          <p className="min-w-0 text-xs text-critical">{error}</p>
          {onRetry ? (
            <Button variant="ghost" size="xs" onClick={onRetry} disabled={isSyncing}>
              <RefreshCw className={cn(isSyncing && 'animate-spin')} />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        {isSessionLoading ? (
          <Skeleton className="h-9 w-full rounded-lg" />
        ) : !isLoggedIn ? (
          <>
            <Button
              size="lg"
              className="w-full"
              nativeButton={false}
              render={<Link href="/login?redirect=/cart" />}
            >
              <LogIn />
              Sign in to check out
            </Button>
            <p className="text-xs text-ink-muted">
              Your cart is saved on this device. Signing in confirms live prices, stock
              and your loyalty balance.
            </p>
          </>
        ) : canCheckout ? (
          <Button
            size="lg"
            className="w-full"
            nativeButton={false}
            render={<Link href="/checkout" />}
          >
            Continue to checkout
          </Button>
        ) : (
          <>
            {/* A disabled link still navigates — so a blocked checkout is a real
                disabled button, with the reason stated under it. */}
            <Button size="lg" className="w-full" disabled>
              Continue to checkout
            </Button>
            {blockedReason ? (
              <p className="text-xs text-critical" role="status">
                {blockedReason}
              </p>
            ) : null}
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-ink-muted"
          nativeButton={false}
          render={<Link href="/shop" />}
        >
          Keep shopping
        </Button>
      </div>
    </aside>
  );
}
