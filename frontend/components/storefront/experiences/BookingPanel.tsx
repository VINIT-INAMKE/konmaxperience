'use client';

/**
 * The booking control on `/experiences/[slug]`.
 *
 * ## It adds a cart line. It does **not** book a seat.
 *
 * This is the single most important fact about this component, and getting it
 * wrong would double-book the villa.
 *
 * SPEC §5.2.2 creates the hold at **quote** time: `POST /customer/checkout/quote`
 * runs `CheckoutService.createHolds`, which writes a `held` `EventBooking` with
 * a fifteen-minute `hold_expires_at` and returns it in the quote's `holds[]`.
 * Nothing before that point reserves anything. So this panel puts a
 * `fulfilment: 'booking'` line in the cart at `quantity = guests` and says so
 * plainly — a customer who reads "added to cart" as "seat reserved" and comes
 * back an hour later has been misled by the UI, not by the backend.
 *
 * ## One booking per customer per sitting, so guests is a *party size*
 *
 * `EventBooking` is `@@unique([event_id, customer_phone])` and
 * `createHolds` turns the P2002 into
 * `You already have a booking for "…"`. A customer therefore cannot hold two
 * bookings on one sitting, which makes the stepper the size of their **whole
 * party**, not an increment. Adding again with a different number **replaces**
 * the line's quantity rather than adding to it — the ordinary
 * "add two more to the basket" behaviour would build a cart the quote is
 * guaranteed to reject.
 *
 * ## The seat count is hold-aware and kept fresh
 *
 * `GET /events/:id` computes `spots_remaining` through `OCCUPYING_BOOKINGS`
 * (confirmed + attended + unexpired holds), so a seat someone else is paying for
 * right now is already excluded. It is re-read every
 * {@link CAPACITY_POLL_MS} and on window focus, because a page left open while
 * the last places go is exactly when a stale bound does damage.
 * `GET /catalog/availability/:productId` is **not** used: its `capacity` branch
 * counts only `confirmed` bookings (see `experience-data.ts`).
 */

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Clock3, Minus, Plus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import { PriceTag } from '@/components/storefront/common/PriceTag';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format/currency';
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart';
import { lineKeyOf, useCartStore } from '@/lib/stores/cart-store';
import type { Event } from '@/lib/types/events';
import {
  defaultVariant,
  storefrontProductImage,
  variantPrice,
  type StorefrontProduct,
} from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

import { CapacityNote, isSoldOut } from './CapacityNote';

/** How often the live seat count is re-read while the page is open. */
export const CAPACITY_POLL_MS = 60_000;

/** The hold the quote creates, in minutes. SPEC §5.2.2; mirrored in the copy below. */
const HOLD_MINUTES = 15;

export interface BookingPanelProps {
  product: StorefrontProduct;
  eventId: string;
  /** The server-rendered event row, used as the query's initial data. */
  initialEvent: Event | null;
  /** `false` once the sitting has run — the panel becomes an explanation. */
  isUpcoming: boolean;
  /** Falls back to this when the event row is unavailable. */
  fallbackCapacity: number;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function BookingPanel({
  product,
  eventId,
  initialEvent,
  isUpcoming,
  fallbackCapacity,
  className,
}: BookingPanelProps) {
  const cart = useStorefrontCart();
  const [chosen, setChosen] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<number | null>(null);

  const { data: event, isError } = useQuery({
    queryKey: ['experience-capacity', eventId],
    queryFn: () => apiClient.get<Event>(`/events/${eventId}`),
    initialData: initialEvent ?? undefined,
    // The server render is seconds old on a `force-dynamic` page, so the first
    // re-read is worth waiting a poll interval for rather than firing on mount.
    staleTime: CAPACITY_POLL_MS,
    refetchInterval: isUpcoming ? CAPACITY_POLL_MS : false,
    refetchOnWindowFocus: isUpcoming,
    enabled: isUpcoming,
  });

  const capacity = event?.capacity ?? fallbackCapacity;
  const spots =
    typeof event?.spots_remaining === 'number' ? Math.max(0, event.spots_remaining) : null;

  // "Unknown" is not "sold out". Refusing to sell because a lookup failed is a
  // worse answer than saying the lookup failed.
  const capacityUnknown = isUpcoming && spots === null;
  const soldOut = isSoldOut(spots);
  const canBook = isUpcoming && !capacityUnknown && !soldOut && cart.isHydrated;

  const seat = defaultVariant(product);
  const unitPrice = variantPrice(product, seat);

  const existing = cart.lines.find((line) => line.productId === product.id) ?? null;
  const existingGuests = existing?.quantity ?? 0;

  const maxGuests = Math.max(1, spots ?? 1);
  const guests = clamp(chosen ?? (existingGuests || 1), 1, maxGuests);

  const setGuests = (next: number) => {
    setChosen(clamp(next, 1, maxGuests));
    setConfirmed(null);
  };

  const handleSubmit = () => {
    if (!canBook) return;

    if (existing) {
      // Replace, never accumulate — see the file header.
      cart.setQuantity(lineKeyOf(existing), guests);
    } else {
      useCartStore.getState().addItem(
        {
          productId: product.id,
          variantId: seat?.id ?? null,
          name: product.name,
          variantName: seat?.name ?? null,
          unitPrice,
          imageUrl: storefrontProductImage(product),
          fulfilment: 'booking',
        },
        guests,
      );
      void cart.sync();
    }

    setConfirmed(guests);
    toast.success(
      guests === 1 ? 'One place added to your cart' : `${guests} places added to your cart`,
      { description: `Your place is held for ${HOLD_MINUTES} minutes once you reach checkout.` },
    );
  };

  if (!isUpcoming) {
    return (
      <div
        data-slot="booking-panel"
        data-state="finished"
        className={cn('rounded-2xl border border-line bg-surface p-6', className)}
      >
        <h2 className="text-base font-semibold text-ink-strong">This sitting has finished</h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          We run this experience again. See what is coming up next.
        </p>
        <Button
          className="mt-4"
          size="lg"
          nativeButton={false}
          render={<Link href="/experiences" />}
        >
          See upcoming experiences
        </Button>
      </div>
    );
  }

  return (
    <div
      data-slot="booking-panel"
      data-state={soldOut ? 'sold-out' : 'open'}
      className={cn('rounded-2xl border border-line bg-surface p-6', className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">Per place</p>
          <PriceTag basePrice={product.base_price} priceDelta={seat?.price_delta} size="lg" />
        </div>
        <CapacityNote spotsRemaining={spots} capacity={capacity} />
      </div>

      {capacityUnknown ? (
        <p className="mt-4 rounded-lg border border-line-warm bg-surface-raised px-3 py-2.5 text-sm text-ink-subtle">
          {isError
            ? 'We could not check how many places are left just now. Try again in a moment.'
            : 'Checking how many places are left…'}
        </p>
      ) : null}

      {soldOut ? (
        <p className="mt-4 rounded-lg border border-line-warm bg-surface-raised px-3 py-2.5 text-sm text-ink-subtle">
          Every place on this sitting is taken. Places sometimes come back when a hold
          expires, so it is worth checking again.
        </p>
      ) : (
        <>
          <div className="mt-6 space-y-2">
            <span id="guests-label" className="block text-sm font-medium text-ink-strong">
              Guests
            </span>
            <div className="flex items-center gap-3">
              <div
                role="group"
                aria-labelledby="guests-label"
                className="flex items-center gap-1 rounded-lg border border-line p-1"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="One guest fewer"
                  disabled={guests <= 1}
                  onClick={() => setGuests(guests - 1)}
                >
                  <Minus className="size-4" aria-hidden="true" />
                </Button>
                <output
                  aria-live="polite"
                  className="w-10 text-center text-base font-semibold tabular-nums text-ink-strong"
                >
                  {guests}
                </output>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="One guest more"
                  disabled={guests >= maxGuests}
                  onClick={() => setGuests(guests + 1)}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <p className="text-sm text-ink-muted">
                {guests >= maxGuests
                  ? `That is every place left on this sitting.`
                  : `Up to ${maxGuests} in one booking.`}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-line pt-4">
            <span className="text-sm text-ink-subtle">
              {guests === 1 ? 'One place' : `${guests} places`}
              <span className="mt-0.5 block text-xs text-ink-faint">
                Confirmed at checkout, including GST
              </span>
            </span>
            <span className="shrink-0 text-base font-semibold tabular-nums text-ink-strong">
              {formatCurrency(Number((unitPrice * guests).toFixed(2)))}
            </span>
          </div>

          <Button
            type="button"
            size="lg"
            className="mt-5 w-full"
            disabled={!canBook}
            onClick={handleSubmit}
          >
            <ShoppingBag className="size-4" aria-hidden="true" />
            {existingGuests > 0 ? 'Update your booking' : 'Add to cart'}
          </Button>

          {confirmed !== null ? (
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-leaf">
              <Check className="size-4" aria-hidden="true" />
              In your cart —{' '}
              <Link href="/cart" className="font-medium underline underline-offset-4">
                review and check out
              </Link>
            </p>
          ) : null}
        </>
      )}

      <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-surface-raised px-3 py-2.5">
        <Clock3 className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-ink-subtle">
          <span className="font-medium text-ink-strong">
            Your place is held for {HOLD_MINUTES} minutes once you reach checkout.
          </span>{' '}
          Adding it here puts it in your cart — it does not reserve the seat yet. One booking
          per guest per sitting, so changing the number above replaces your party size rather
          than adding a second booking.
        </p>
      </div>
    </div>
  );
}
