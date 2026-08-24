import { cache } from 'react';

import type { Event, EventType } from '@/lib/types/events';
import type { CatalogEnvelope, StorefrontProduct } from '@/lib/types/storefront';

/**
 * Server-side loaders for `/experiences` and `/experiences/[slug]`.
 *
 * ## Two routes, because neither one alone is enough
 *
 * An experience is a **product** joined to an **event**. The catalog route owns
 * everything the cart needs — `slug`, `base_price`, `media`, `variants`,
 * `description` — but its `PUBLIC_INCLUDE` trims the event join to
 * `{ id, date, capacity }` (`backend/src/catalog/catalog.service.ts:50`). No
 * venue, no status, and critically **no seat count**.
 *
 * `GET /events` and `GET /events/:id` are `@Public()`
 * (`backend/src/events/events.controller.ts:31,46`) and answer with the whole
 * event row plus `booked_guests` and `spots_remaining`, computed through
 * `OCCUPYING_BOOKINGS` — `confirmed` + `attended` + any `held` row whose
 * `hold_expires_at` has not passed. That predicate is the one that makes the
 * fifteen-minute checkout hold safe, so it is the only seat count this feature
 * is allowed to render.
 *
 * ## Why not `GET /catalog/availability/:productId`
 *
 * The plan sketch pointed the booking panel at the availability route. Reading
 * it settled the question the other way: its `capacity` branch loads
 * `bookings: { where: { status: confirmed } }`
 * (`catalog.service.ts:829`) — **no `attended`, and no live holds.** It would
 * therefore report a seat as free while another customer is fifteen minutes
 * into paying for it, which is precisely the double-book this feature exists to
 * prevent. `backend/**` belongs to another task, so the fix here is to read the
 * hold-aware route instead of the optimistic one.
 *
 * ## Freshness
 *
 * Both pages are `force-dynamic` and every fetch is `no-store`. A seat count is
 * live data, and a build machine has no backend to talk to — a statically
 * prerendered `/experiences` would bake an empty list into the deployment. The
 * backend already caches the public catalog for 60 s, so the cost is bounded.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** More experiences than this on one page stops being a list. */
const MAX_EXPERIENCES = 100;

/**
 * A product joined to its sitting, with the seat count already resolved.
 *
 * `event` is the full hold-aware row when the sitting is still upcoming and
 * `null` once it is over — `GET /events` only returns future, non-cancelled
 * sittings, and the staff `GET /events/all` needs `MANAGE_OPS`. A past
 * experience therefore renders from the product's trimmed join alone, which is
 * all an archive entry needs.
 */
export interface Experience {
  product: StorefrontProduct;
  /** The hold-aware event row, or `null` for a sitting that has already run. */
  event: Event | null;
  /** ISO 8601 start of the sitting. */
  startsAt: string;
  capacity: number;
  /**
   * Seats left, counting confirmed guests, attended guests **and live holds**.
   * `null` for a past sitting, where the number is meaningless.
   */
  spotsRemaining: number | null;
  /** The zone the sitting runs in, when the event names one. */
  venue: string | null;
  eventType: EventType | null;
  isUpcoming: boolean;
}

/** The two groups `/experiences` renders, already sorted. */
export interface ExperienceGroups {
  /** Soonest first — the next sitting is the one a visitor can act on. */
  upcoming: Experience[];
  /** Most recent first. Archive only; nothing here is bookable. */
  past: Experience[];
  /**
   * `true` when neither public route answered. The page says "we could not load
   * this" rather than "there are no experiences", because those are different
   * facts and a shopper deserves the true one.
   */
  failed: boolean;
}

async function fetchPublicJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // No backend (a build machine), a DNS failure, a timeout.
    return null;
  }
}

/** `product.status` is the storefront's publish switch; drafts never leave the ops app. */
function isPublishedExperience(product: StorefrontProduct): boolean {
  return product.type === 'experience' && product.status === 'active' && !!product.event;
}

function venueOf(event: Event | null): string | null {
  return event?.zone?.name ?? null;
}

/**
 * Folds one product and its (possibly absent) event row into an {@link Experience}.
 *
 * `spots_remaining` is optional on the `Event` type because the ops CRUD routes
 * return rows without it; the two public routes always enrich, so a missing
 * value here means the shape changed and is treated as "unknown" rather than as
 * zero — reporting a sold-out sitting that is not sold out is its own failure.
 */
function toExperience(
  product: StorefrontProduct,
  event: Event | null,
  isUpcoming: boolean,
): Experience {
  const capacity = event?.capacity ?? product.event?.capacity ?? 0;
  const remaining =
    event && typeof event.spots_remaining === 'number'
      ? Math.max(0, event.spots_remaining)
      : null;

  return {
    product,
    event,
    startsAt: event?.date ?? product.event?.date ?? '',
    capacity,
    spotsRemaining: isUpcoming ? remaining : null,
    venue: venueOf(event),
    eventType: event?.event_type ?? null,
    isUpcoming,
  };
}

/**
 * `/experiences` — every published experience product, grouped by whether its
 * sitting is still ahead.
 *
 * **`draft` and `cancelled` sittings never appear**, and the two are excluded by
 * different means because the backend exposes them differently:
 *
 * - `draft` **is** returned by `GET /events` (`findUpcoming` filters only on
 *   `date` and `cancelled`), so it is filtered here by id — a draft is skipped
 *   whatever its date says.
 * - `cancelled` is **withheld** by `GET /events`, so it surfaces as an event id
 *   the map does not know. An unknown id with a future date is therefore
 *   cancelled and skipped; an unknown id with a past date is simply over.
 *
 * The one case this cannot separate is a sitting cancelled *after* it would have
 * run: it lands in the archive. Nothing is bookable there and the backend
 * exposes no public signal to do better, so it is recorded rather than guessed at.
 */
export const loadExperiences = cache(async function loadExperiences(): Promise<ExperienceGroups> {
  const [page, events] = await Promise.all([
    fetchPublicJson<CatalogEnvelope<StorefrontProduct>>(
      `/catalog/products?type=experience&limit=${MAX_EXPERIENCES}`,
    ),
    fetchPublicJson<Event[]>('/events'),
  ]);

  if (page === null && events === null) {
    return { upcoming: [], past: [], failed: true };
  }

  const products = Array.isArray(page?.items) ? page.items : [];

  const live = new Map<string, Event>();
  const hidden = new Set<string>();
  for (const event of Array.isArray(events) ? events : []) {
    if (!event?.id) continue;
    if (event.status === 'draft') {
      hidden.add(event.id);
      continue;
    }
    live.set(event.id, event);
  }

  const now = Date.now();
  const upcoming: Experience[] = [];
  const past: Experience[] = [];

  for (const product of products) {
    if (!isPublishedExperience(product)) continue;
    const join = product.event;
    if (!join) continue;
    if (hidden.has(join.id)) continue;

    const event = live.get(join.id) ?? null;
    if (event) {
      upcoming.push(toExperience(product, event, true));
      continue;
    }

    const startsAt = Date.parse(join.date);
    // Unparseable or still ahead with no live row: cancelled, or withheld for a
    // reason the public API does not name. Either way it is not on sale.
    if (!Number.isFinite(startsAt) || startsAt > now) continue;
    past.push(toExperience(product, null, false));
  }

  upcoming.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  past.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));

  return { upcoming, past, failed: false };
});

/**
 * `/experiences/[slug]` — one experience, or `null` for anything that must not
 * have a public page: a missing slug, a product that is not an experience, a
 * draft or archived product, an experience with no sitting attached, and a
 * sitting that is `draft` or `cancelled`.
 *
 * Wrapped in React's `cache` so `generateMetadata` and the page body share one
 * pair of requests per render rather than issuing two.
 */
export const loadExperience = cache(async function loadExperience(
  slug: string,
): Promise<Experience | null> {
  if (!slug) return null;

  const product = await fetchPublicJson<StorefrontProduct>(
    `/catalog/products/slug/${encodeURIComponent(slug)}`,
  );
  if (!product || !isPublishedExperience(product)) return null;

  const join = product.event;
  if (!join) return null;

  const event = await fetchPublicJson<Event>(`/events/${join.id}`);
  if (event && (event.status === 'draft' || event.status === 'cancelled')) return null;

  const startsAt = Date.parse(event?.date ?? join.date);
  const isUpcoming = Number.isFinite(startsAt) && startsAt > Date.now();

  return toExperience(product, event, isUpcoming);
});
