'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CircleCheck, CircleSlash, Loader2 } from 'lucide-react';

import type { StockMode } from '@/lib/types/catalog';
import type { StorefrontAvailability } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

/**
 * Live availability for one product, and the sentence that explains it.
 *
 * **Why a raw `fetch` and not `apiClient`:** `apiClient` treats a `401` as a
 * *staff* session expiry — it clears the auth store and navigates the tab to
 * `/team`. `GET /catalog/availability/:productId` is `@Public()` (P5b Task 2
 * added the decorator), but a shopper must never be thrown at the staff login
 * because a catalog read hiccuped, so this path stays deliberately dumb.
 *
 * **The refetch window is 60 s, matching the backend's own cache.** Servings
 * are derived from live ingredient stock and move while a customer reads the
 * page; a stale "3 left" that never updates is how a cart reaches checkout and
 * gets rejected.
 *
 * **`stock_mode` chooses the sentence, not the number.** The three modes mean
 * genuinely different things — a made-to-order dish counts servings the kitchen
 * could still assemble, a tracked SKU counts units on a shelf, and an
 * experience counts seats that only the experience page can sell. Averaging
 * them into "N available" would be wrong in all three.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Matches the backend's `CatalogCacheService` window. */
export const AVAILABILITY_REFETCH_MS = 60_000;

export function productAvailabilityKey(productId: string): readonly unknown[] {
  return ['catalog', 'availability', productId];
}

/**
 * One shared query for the whole product page.
 *
 * `AddToCartPanel` needs the boolean to disable its button and `AvailabilityNote`
 * needs the count for its sentence; both call this hook and TanStack Query
 * collapses them onto a single request through the shared key.
 */
export function useProductAvailability(productId: string) {
  return useQuery<StorefrontAvailability>({
    queryKey: productAvailabilityKey(productId),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/catalog/availability/${productId}`, {
        credentials: 'omit',
      });
      if (!response.ok) {
        throw new Error(`GET /catalog/availability/${productId} answered ${response.status}`);
      }
      return (await response.json()) as StorefrontAvailability;
    },
    refetchInterval: AVAILABILITY_REFETCH_MS,
    staleTime: AVAILABILITY_REFETCH_MS,
    retry: 1,
  });
}

export interface AvailabilityNoteProps {
  stockMode: StockMode;
  availability: StorefrontAvailability | undefined;
  isLoading?: boolean;
  /** `true` when the availability call itself failed — the page stays buyable. */
  isError?: boolean;
  className?: string;
}

interface Note {
  tone: 'good' | 'muted' | 'gone';
  text: string;
}

function noteFor(
  stockMode: StockMode,
  availability: StorefrontAvailability,
): Note {
  const remaining = Math.max(0, Math.floor(availability.servings_remaining));

  if (stockMode === 'capacity') {
    return availability.available
      ? {
          tone: 'good',
          text:
            remaining > 0
              ? `${remaining} ${remaining === 1 ? 'place' : 'places'} left · book on the experience page`
              : 'Places are released on the experience page',
        }
      : { tone: 'gone', text: 'Fully booked' };
  }

  if (stockMode === 'tracked') {
    if (!availability.available || remaining <= 0) {
      return { tone: 'gone', text: 'Out of stock' };
    }
    return remaining <= 5
      ? { tone: 'muted', text: `Only ${remaining} left in stock` }
      : { tone: 'good', text: `${remaining} in stock` };
  }

  // derived_from_recipe — servings the kitchen can still assemble today.
  if (!availability.available || remaining <= 0) {
    return { tone: 'gone', text: 'Sold out for today' };
  }
  return {
    tone: remaining <= 5 ? 'muted' : 'good',
    text: `Made to order · ${remaining} ${remaining === 1 ? 'serving' : 'servings'} left today`,
  };
}

const TONE_CLASS: Record<Note['tone'], string> = {
  good: 'text-leaf',
  muted: 'text-ink-subtle',
  gone: 'text-ink-muted',
};

export function AvailabilityNote({
  stockMode,
  availability,
  isLoading = false,
  isError = false,
  className,
}: AvailabilityNoteProps) {
  if (isLoading) {
    return (
      <p
        data-slot="availability-note"
        className={cn('flex items-center gap-1.5 text-sm text-ink-faint', className)}
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Checking availability…
      </p>
    );
  }

  // A failed availability read must not imply "sold out" — the cart sync and the
  // quote are the authoritative gates, and both run before any money moves.
  if (isError || !availability) {
    return (
      <p
        data-slot="availability-note"
        className={cn('text-sm text-ink-faint', className)}
      >
        Availability is confirmed at checkout.
      </p>
    );
  }

  const note = noteFor(stockMode, availability);
  const Icon =
    note.tone === 'gone' ? CircleSlash : stockMode === 'capacity' ? CalendarClock : CircleCheck;

  return (
    <p
      data-slot="availability-note"
      aria-live="polite"
      className={cn('flex items-center gap-1.5 text-sm font-medium', TONE_CLASS[note.tone], className)}
    >
      <Icon className="size-4" aria-hidden="true" />
      {note.text}
    </p>
  );
}
