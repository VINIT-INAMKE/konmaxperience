'use client';

/**
 * `/cart` — the client half (`STORE-02`).
 *
 * The route's `page.tsx` stays a server component so it can export `metadata`
 * (`robots: index: false` — a cart is nobody's search result); everything that
 * needs state lives here.
 *
 * ## What this screen is responsible for
 *
 * 1. **Server prices win.** `useStorefrontCart({ syncOnMount: true })` calls
 *    `POST /customer/cart/sync` as soon as the cart has hydrated and a session
 *    exists, and again 400 ms after the last quantity edit. The optimistic local
 *    subtotal is replaced by `totals.subtotal` the moment the server answers.
 * 2. **Repricing is announced, not hidden.** `repricedKeys` names the lines the
 *    server moved; each one is marked, and the page says how many changed.
 * 3. **Mixed fulfilment is legible.** Lines are grouped into villa-kitchen,
 *    shipped and booked sections, each explaining how it will actually reach the
 *    customer, rather than being flattened into one indistinguishable list.
 * 4. **Rejected lines block checkout here, on purpose.** The quote would answer
 *    `400` anyway; failing on the cart, next to the item and its reason, is
 *    kinder than failing three steps later with an address half typed.
 * 5. **No grand total** (P5b decision 6). See `CartSummary`.
 *
 * ## What it deliberately does not do
 *
 * It never calls the quote, the coupon or the loyalty endpoints. Those need an
 * address and belong to `/checkout`; touching them here would force an address
 * prompt on a customer who has not yet decided to buy.
 */

import Link from 'next/link';
import { Loader2, LogIn, RefreshCw } from 'lucide-react';

import { CartChannelSelector } from '@/components/storefront/cart/CartChannelSelector';
import { CartLineList } from '@/components/storefront/cart/CartLineList';
import { CartSummary } from '@/components/storefront/cart/CartSummary';
import { EmptyCart } from '@/components/storefront/cart/EmptyCart';
import { RejectedLines } from '@/components/storefront/cart/RejectedLines';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart';

function CartHeading({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
        Your cart
      </h1>
      {children}
    </div>
  );
}

/**
 * `persist` reads `localStorage` after the first paint, so the server HTML
 * always describes an empty cart. Painting the restored one before hydration
 * finishes is a React mismatch — and flashing "your cart is empty" at someone
 * holding four items is worse than a skeleton.
 */
function CartLoading() {
  return (
    <div className="space-y-6">
      <CartHeading />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <StorefrontSkeleton variant="list" count={3} />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function CartView() {
  const cart = useStorefrontCart({ syncOnMount: true });

  if (!cart.isHydrated) return <CartLoading />;

  if (cart.lines.length === 0) {
    return (
      <div className="space-y-6">
        <CartHeading />
        <EmptyCart />
      </div>
    );
  }

  const repricedCount = cart.repricedKeys.size;
  const isGuest = !cart.isLoggedIn && !cart.isSessionLoading;

  return (
    <div className="space-y-6">
      <CartHeading>
        <span className="flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
          {cart.isSyncing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Checking prices…
            </>
          ) : (
            <>
              {cart.count} item{cart.count === 1 ? '' : 's'}
            </>
          )}
        </span>
      </CartHeading>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-5">
          {/*
            The guest cart is real — it lives in `localStorage` and survives a
            reload — but nothing in it has been priced by the server yet, so the
            page says so rather than presenting cached figures as confirmed.
          */}
          {isGuest ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-warm bg-surface-raised px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-strong">
                  You are browsing as a guest
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Your cart is saved on this device. Sign in and we will confirm live
                  prices, stock and what is actually available today.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                nativeButton={false}
                render={<Link href="/login?redirect=/cart" />}
              >
                <LogIn />
                Sign in
              </Button>
            </div>
          ) : null}

          {repricedCount > 0 ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs text-ink-subtle"
            >
              <RefreshCw className="size-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
              {repricedCount === 1
                ? 'One price changed since you added it — the new price is marked below.'
                : `${repricedCount} prices changed since you added them — the new prices are marked below.`}
            </p>
          ) : null}

          <RejectedLines
            lines={cart.unavailable}
            busy={cart.isSyncing}
            onRemove={cart.remove}
            onRemoveAll={cart.removeUnavailable}
          />

          {/* Channel is a pricing input for kitchen items only — see the component. */}
          {cart.groups.local.length > 0 ? (
            <CartChannelSelector
              channel={cart.channel}
              onChange={cart.setChannel}
              disabled={cart.isSyncing}
            />
          ) : null}

          <CartLineList
            groups={cart.groups}
            repricedKeys={cart.repricedKeys}
            busy={cart.isSyncing}
            onIncrement={cart.increment}
            onDecrement={cart.decrement}
            onRemove={cart.remove}
          />
        </div>

        <CartSummary
          className="lg:sticky lg:top-24"
          itemCount={cart.count}
          subtotal={cart.subtotal}
          taxTotal={cart.taxTotal}
          isServerPriced={cart.isServerPriced}
          isSyncing={cart.isSyncing}
          isLoggedIn={cart.isLoggedIn}
          isSessionLoading={cart.isSessionLoading}
          canCheckout={cart.canCheckout}
          blockedReason={cart.blockedReason}
          error={cart.error}
          onRetry={() => void cart.sync()}
        />
      </div>
    </div>
  );
}
