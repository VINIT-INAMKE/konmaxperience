'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { CalendarDays, Minus, Plus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import { PriceTag } from '@/components/storefront/common/PriceTag';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import type { StorefrontProduct } from '@/lib/types/storefront';
import {
  defaultVariant,
  storefrontProductImage,
  variantPrice,
} from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

import { AvailabilityNote, useProductAvailability } from './AvailabilityNote';
import { VariantPicker } from './VariantPicker';

/**
 * The buy box: price, variant, quantity and the one button that writes to the
 * cart.
 *
 * **`variantId` is carried into the cart, always.** The store keys lines by
 * `` `${productId}:${variantId ?? ''}` `` (P5b decision 2), so a product with
 * variants that reached the cart without one would collide with every other
 * variant of itself at whichever price landed first. The guard is structural: a
 * product with `variants[]` cannot be added until `selectedVariantId` is set,
 * and the selection seeds from `is_default` so the common path is one click.
 *
 * **An `experience` never adds blind.** Capacity and the sitting date live on
 * `/experiences/[slug]`, and the 15-minute `EventBooking` hold is created at
 * *quote* time, not here — adding a seat from this page would let a customer
 * believe a place was held when none was. The panel links out instead.
 *
 * **This is the one optimistic write on the page** (P5b decision 24 permits it —
 * a cart line is not the money path). The line appears instantly and a server
 * sync follows for a signed-in customer; the price the customer is finally
 * asked to agree to is re-derived by `POST /customer/cart/sync` and again by the
 * quote (`CHK-01`), so an optimistic local price can never become a charge.
 */
export interface AddToCartPanelProps {
  product: StorefrontProduct;
  className?: string;
}

/** A cart is not a wholesale order; the quote and stock gates live server-side. */
const MAX_QUANTITY = 20;

export function AddToCartPanel({ product, className }: AddToCartPanelProps) {
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const seeded = useMemo(() => defaultVariant(product), [product]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    seeded?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);

  const { addItem, syncToServer, isLoggedIn } = useCart();
  const {
    data: availability,
    isPending: isAvailabilityPending,
    isError: isAvailabilityError,
  } = useProductAvailability(product.id);

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );
  const unitPrice = variantPrice(product, selected);

  const isExperience = product.type === 'experience';
  const needsVariant = variants.length > 0 && selectedVariantId === null;
  // A failed availability read must not block a sale — the cart sync and the
  // quote both re-check stock before any money moves.
  const isSoldOut = availability ? !availability.available : false;

  /** Never let the stepper promise more than the kitchen or the shelf can hold. */
  const maxQuantity = useMemo(() => {
    if (!availability || !availability.available) return MAX_QUANTITY;
    const remaining = Math.floor(availability.servings_remaining);
    if (!Number.isFinite(remaining) || remaining <= 0) return MAX_QUANTITY;
    return Math.max(1, Math.min(MAX_QUANTITY, remaining));
  }, [availability]);

  const changeQuantity = useCallback(
    (delta: number) => {
      setQuantity((current) => Math.min(maxQuantity, Math.max(1, current + delta)));
    },
    [maxQuantity],
  );

  const handleAdd = useCallback(() => {
    if (needsVariant) {
      toast.error('Choose an option first');
      return;
    }

    addItem(
      {
        productId: product.id,
        variantId: selectedVariantId,
        variantName: selected?.name ?? null,
        name: product.name,
        unitPrice,
        imageUrl: storefrontProductImage(product),
        fulfilment: product.fulfilment,
      },
      quantity,
    );

    toast.success(`${product.name} added to your cart`, {
      description: selected ? selected.name : undefined,
    });

    // Signed-in carts live on the server too; the sync re-prices the line and
    // is deliberately not awaited — the local line is already on screen.
    if (isLoggedIn) {
      void syncToServer().catch(() => {
        /* The cart page surfaces sync failures; the line is safe locally. */
      });
    }
  }, [
    addItem,
    isLoggedIn,
    needsVariant,
    product,
    quantity,
    selected,
    selectedVariantId,
    syncToServer,
    unitPrice,
  ]);

  return (
    <div data-slot="add-to-cart-panel" className={cn('space-y-5', className)}>
      <div className="space-y-1">
        <PriceTag basePrice={product.base_price} priceDelta={selected?.price_delta ?? 0} size="lg" />
        <p className="text-xs text-ink-faint">Inclusive of all taxes</p>
      </div>

      <AvailabilityNote
        stockMode={product.stock_mode}
        availability={availability}
        isLoading={isAvailabilityPending}
        isError={isAvailabilityError}
      />

      {variants.length > 1 ? (
        <VariantPicker
          variants={variants}
          basePrice={product.base_price}
          value={selectedVariantId}
          onChange={(id) => setSelectedVariantId(id)}
          name={`variant-${product.id}`}
          disabled={isExperience}
        />
      ) : null}

      {isExperience ? (
        <div className="space-y-3 rounded-xl border border-line-warm bg-surface-raised p-4">
          <p className="text-sm text-ink-subtle">
            Places are chosen with a date and a guest count. Your seat is held for 15 minutes
            once you reach checkout.
          </p>
          <Button size="lg" nativeButton={false} render={<Link href={`/experiences/${product.slug}`} />}>
            <CalendarDays className="size-4" aria-hidden="true" />
            View dates and book
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1"
              role="group"
              aria-label="Quantity"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => changeQuantity(-1)}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" aria-hidden="true" />
              </Button>
              <span
                aria-live="polite"
                className="w-8 text-center text-sm font-medium tabular-nums text-ink-strong"
              >
                {quantity}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => changeQuantity(1)}
                disabled={quantity >= maxQuantity}
                aria-label="Increase quantity"
              >
                <Plus className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <Button
              size="lg"
              className="min-w-44 flex-1"
              onClick={handleAdd}
              disabled={isSoldOut || needsVariant}
            >
              <ShoppingBag className="size-4" aria-hidden="true" />
              {isSoldOut ? 'Sold out' : 'Add to cart'}
            </Button>
          </div>

          {needsVariant ? (
            <p className="text-sm text-ink-muted">Choose an option to continue.</p>
          ) : null}
          {isSoldOut ? (
            <p className="text-sm text-ink-muted">
              This one has gone for now. Availability refreshes every minute.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
