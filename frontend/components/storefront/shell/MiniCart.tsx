'use client';

/**
 * The cart sheet the shell's `MiniCartTrigger` opens.
 *
 * Three rules from the plan shape it:
 *
 * - **No grand total** (P5b decision 6). Shipping, coupon discount and loyalty
 *   only exist inside a quote, and quoting needs an address. The sheet shows
 *   "Subtotal (incl. GST)", the GST already inside it as an *of which* line, and
 *   says plainly where the rest is calculated.
 * - **Tax is never added** (P5a decision 1). `tax_total` is carved out of
 *   `subtotal`; rendering it as a `+` line would double-charge every order.
 * - **Unavailable lines stay visible.** A line the server refused renders dimmed
 *   with its `unavailable_reason` verbatim, because silently dropping it is how
 *   a customer arrives at checkout wondering what happened to their order.
 *
 * The sheet owns no cart logic of its own: quantities, debounced syncing and
 * the hydration gate all come from `useStorefrontCart`.
 */

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format/currency';
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart';
import { lineKeyOf, type CartLine } from '@/lib/stores/cart-store';

export interface MiniCartProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** `next/image` throws on a non-absolute or unconfigured host; degrade instead. */
function isRenderableImage(url: string | null): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

function LineThumb({ line }: { line: CartLine }) {
  if (isRenderableImage(line.imageUrl)) {
    return (
      <Image
        src={line.imageUrl}
        alt=""
        width={56}
        height={56}
        className="size-14 rounded-md object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex size-14 items-center justify-center rounded-md bg-surface-raised text-lg font-semibold text-ink-faint"
    >
      {line.name.charAt(0).toUpperCase()}
    </div>
  );
}

function QuantityStepper({
  line,
  onDecrement,
  onIncrement,
}: {
  line: CartLine;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface">
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        onClick={onDecrement}
        aria-label={`Decrease quantity of ${line.name}`}
      >
        <Minus />
      </Button>
      <span className="min-w-5 text-center text-sm font-medium tabular-nums text-ink">
        {line.quantity}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        onClick={onIncrement}
        aria-label={`Increase quantity of ${line.name}`}
      >
        <Plus />
      </Button>
    </div>
  );
}

function MiniCartLine({
  line,
  repriced,
  onDecrement,
  onIncrement,
  onRemove,
}: {
  line: CartLine;
  repriced: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  onRemove: () => void;
}) {
  const unavailable = line.available === false;
  return (
    <li
      className={`flex gap-3 px-4 py-3 ${unavailable ? 'opacity-60' : ''}`}
      data-unavailable={unavailable || undefined}
    >
      <LineThumb line={line} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{line.name}</p>
        {line.variantName ? (
          <p className="truncate text-xs text-ink-muted">{line.variantName}</p>
        ) : null}
        {unavailable ? (
          <p className="mt-0.5 text-xs text-critical">
            {line.unavailable_reason ?? 'Currently unavailable'}
          </p>
        ) : null}
        {repriced && !unavailable ? (
          <p className="mt-0.5 text-xs text-ink-muted">Price updated</p>
        ) : null}
        <div className="mt-2 flex items-center gap-2">
          {unavailable ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={onRemove}
              aria-label={`Remove ${line.name} from your cart`}
            >
              <Trash2 />
              Remove
            </Button>
          ) : (
            <QuantityStepper
              line={line}
              onDecrement={onDecrement}
              onIncrement={onIncrement}
            />
          )}
        </div>
      </div>
      <p className="shrink-0 text-sm font-medium tabular-nums text-ink">
        {formatCurrency(line.unitPrice * line.quantity)}
      </p>
    </li>
  );
}

function MiniCartEmpty({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <ShoppingBag className="size-8 text-ink-faint" aria-hidden />
      <p className="text-sm font-medium text-ink">Your cart is empty</p>
      <p className="text-sm text-ink-muted">
        Everything from the kitchen, the pantry and the calendar lives in the shop.
      </p>
      <Button nativeButton={false} render={<Link href="/shop" onClick={onClose} />}>
        Browse the shop
      </Button>
    </div>
  );
}

export function MiniCart({ open, onOpenChange }: MiniCartProps) {
  const cart = useStorefrontCart();
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-line px-4 py-3">
          <SheetTitle>
            Your cart
            {cart.isHydrated && cart.count > 0 ? (
              <span className="ml-2 text-sm font-normal text-ink-muted" aria-live="polite">
                {cart.count} item{cart.count === 1 ? '' : 's'}
              </span>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        {!cart.isHydrated ? (
          <div className="flex flex-col gap-3 p-4" aria-hidden>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : cart.lines.length === 0 ? (
          <MiniCartEmpty onClose={close} />
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto">
              {cart.lines.map((line) => {
                const key = lineKeyOf(line);
                return (
                  <MiniCartLine
                    key={key}
                    line={line}
                    repriced={cart.repricedKeys.has(key)}
                    onDecrement={() => cart.decrement(key)}
                    onIncrement={() => cart.increment(key)}
                    onRemove={() => cart.remove(key)}
                  />
                );
              })}
            </ul>

            <SheetFooter className="shrink-0 gap-3 border-t border-line px-4 py-4">
              {cart.unavailable.length > 0 ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-raised px-3 py-2">
                  <p className="text-xs text-ink-subtle">{cart.blockedReason}</p>
                  <Button variant="ghost" size="xs" onClick={cart.removeUnavailable}>
                    Remove all
                  </Button>
                </div>
              ) : null}

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-ink">Subtotal (incl. GST)</span>
                <span className="text-base font-semibold tabular-nums text-ink">
                  {formatCurrency(cart.subtotal)}
                </span>
              </div>

              {cart.taxTotal !== null ? (
                <div className="flex items-baseline justify-between text-xs text-ink-muted">
                  <span>of which GST</span>
                  <span className="tabular-nums">{formatCurrency(cart.taxTotal)}</span>
                </div>
              ) : null}

              {/*
                The one honest thing a cart can say about the rest of the money:
                it is not knowable until an address exists (P5b decision 6).
              */}
              <p className="text-xs text-ink-muted">
                Shipping, coupons and loyalty are calculated at checkout.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  nativeButton={false}
                  render={<Link href="/cart" onClick={close} />}
                >
                  View cart
                </Button>
                {/*
                  A disabled link still navigates, so a blocked checkout renders
                  a real disabled button — the reason is already stated above it.
                */}
                {cart.canCheckout ? (
                  <Button
                    className="flex-1"
                    nativeButton={false}
                    render={
                      <Link
                        href={cart.isLoggedIn ? '/checkout' : '/login?redirect=/checkout'}
                        onClick={close}
                      />
                    }
                  >
                    Checkout
                  </Button>
                ) : (
                  <Button className="flex-1" disabled>
                    Checkout
                  </Button>
                )}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
