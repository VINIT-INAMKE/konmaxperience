import type { MetadataRoute } from 'next';

import type { Event } from '@/lib/types/events';
import type {
  StorefrontCategory,
  StorefrontProduct,
  StorefrontProductPage,
} from '@/lib/types/storefront';
import { absoluteUrl } from '@/lib/seo/metadata';

/**
 * `/sitemap.xml` (`STORE-01`) — generated from the live catalogue, never a
 * hand-kept list.
 *
 * ## What is in it
 *
 * `/`, `/shop`, `/experiences`, `/search`, every `/shop/[category]` slug, every
 * `/p/[slug]` for an **active, non-experience** product, and every
 * `/experiences/[slug]` for an experience whose sitting is neither `draft` nor
 * `cancelled`. Nothing session-scoped is here: `/cart`, `/checkout`,
 * `/account/*`, `/orders/[id]/track`, `/feedback/*` and `/login` are all
 * `Disallow`ed in `robots.ts` and all carry `robots: { index: false }`.
 *
 * ## Why an experience is listed once, not twice
 *
 * An experience product resolves at **both** `/p/[slug]` and
 * `/experiences/[slug]` — `findProductBySlug` does not discriminate by type, and
 * `/p/[slug]` deliberately renders one with an "Experiences" breadcrumb.
 * `/experiences/[slug]` is nonetheless the canonical address: it is what
 * `ExperienceCard` links to, it is where `/p/[slug]`'s own booking button sends
 * the visitor (`components/storefront/product/AddToCartPanel.tsx:167`), and it is
 * the only one of the two that renders the hold-aware seat count. Submitting
 * both would be volunteering a duplicate, so experiences are filtered out of the
 * `/p/` list and appear under `/experiences/` alone.
 *
 * ## Why the fetches are written here rather than imported
 *
 * The storefront's own loaders are tuned to a *page* render:
 * `components/storefront/catalog/catalog-data.ts` caps at one page and
 * `components/storefront/experiences/experience-data.ts` is `cache: 'no-store'`
 * because a seat count is live data. A sitemap needs the opposite of both — the
 * whole set, cached for an hour — so it reuses the pattern (raw `fetch` against
 * the `@Public()` routes, never the cookie-bound `apiClient`, `null` on failure
 * rather than a throw) and not the call sites. The `draft`/`cancelled` rules
 * below are the same ones `experience-data.ts` documents, for the same reasons.
 *
 * ## Failure is an omission, not an outage
 *
 * Every fetch resolves to `null` on any failure, and a `null` simply drops that
 * group of URLs. A build machine with no backend therefore still produces a
 * valid sitemap carrying the four static routes, and a catalogue hiccup at
 * revalidation time yields a short sitemap rather than a `500` that tells a
 * crawler the file is broken.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** One hour. The catalogue changes on a human timescale; the backend caches 60 s under this. */
export const revalidate = 3600;

/** `LIST_LIMIT_MAX` in `catalog.service.ts` — asking for more is silently clamped. */
const PAGE_SIZE = 200;

/**
 * A stop on the cursor walk. 200 × 50 is 10 000 products, an order of magnitude
 * past anything this catalogue will hold; it exists so a backend that ever
 * returned a non-advancing cursor cannot spin the build forever.
 */
const MAX_PAGES = 50;

async function fetchPublicJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate },
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // No backend (a build machine), DNS, a timeout.
    return null;
  }
}

/**
 * `updated_at` → a `Date` a sitemap entry will accept, or `undefined`.
 *
 * A malformed timestamp is dropped rather than coerced: `lastModified` is a hint
 * to a crawler about when to come back, and `Invalid Date` serialises to
 * something no crawler can parse.
 */
function lastModified(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Walks `GET /catalog/products` through every `next_cursor`.
 *
 * `next_cursor` is opaque and is handed back verbatim; the loop stops when the
 * backend returns `null`, when a page comes back empty, or when the cursor stops
 * moving. `null` on the *first* page means the catalogue could not be read at
 * all, which is different from an empty catalogue and is reported as such.
 */
async function fetchAllActiveProducts(): Promise<StorefrontProduct[] | null> {
  const products: StorefrontProduct[] = [];
  let cursor: string | null = null;
  let seen: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) query.set('cursor', cursor);

    const envelope: StorefrontProductPage | null =
      await fetchPublicJson<StorefrontProductPage>(`/catalog/products?${query}`);

    if (!envelope || !Array.isArray(envelope.items)) {
      // A failure part-way through still yields what was already collected —
      // a shorter sitemap beats no sitemap.
      return page === 0 ? null : products;
    }

    products.push(...envelope.items);

    const next = envelope.next_cursor;
    if (!next || envelope.items.length === 0 || next === seen) break;
    seen = next;
    cursor = next;
  }

  return products;
}

/** A slug is only routable when it is non-empty; an archived shelf is already withheld server-side. */
function isListableCategory(category: StorefrontCategory): boolean {
  return category.status === 'active' && category.slug.trim() !== '';
}

/**
 * `GET /catalog/categories` returns whole rows, so `updated_at` is on the wire
 * even though `StorefrontCategory` (which mirrors only what a component may
 * read) does not declare it. Read as optional rather than widening the shared
 * type from here.
 */
type SitemapCategory = StorefrontCategory & { updated_at?: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, events] = await Promise.all([
    fetchAllActiveProducts(),
    fetchPublicJson<SitemapCategory[]>('/catalog/categories'),
    fetchPublicJson<Event[]>('/events'),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/shop'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/experiences'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/search'), changeFrequency: 'monthly', priority: 0.3 },
  ];

  for (const category of Array.isArray(categories) ? categories : []) {
    if (!isListableCategory(category)) continue;
    entries.push({
      url: absoluteUrl(`/shop/${category.slug}`),
      lastModified: lastModified(category.updated_at),
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  /**
   * Two sets, from one pass over `GET /events`:
   *
   * - `hidden` — sittings `GET /events` returns but the storefront refuses:
   *   `findUpcoming` filters on `date` and `cancelled` only, so a **draft**
   *   arrives here and must be dropped by id.
   * - `live` — everything else it returned, which is by construction upcoming
   *   and not cancelled.
   *
   * A `cancelled` sitting is *withheld* by the route, so it surfaces as an event
   * id in neither set. That is indistinguishable from a sitting that has simply
   * already run, and the two are separated by date exactly as
   * `experience-data.ts` does it: an unknown id with a future date is cancelled
   * (skip), an unknown id with a past date is over (an archive page, which
   * renders and is worth listing).
   */
  const hidden = new Set<string>();
  const live = new Set<string>();
  for (const event of Array.isArray(events) ? events : []) {
    if (!event?.id) continue;
    if (event.status === 'draft') hidden.add(event.id);
    else live.add(event.id);
  }
  // With no answer from `/events` at all, no experience can be shown to be
  // bookable, so none is listed rather than guessing.
  const eventsKnown = Array.isArray(events);

  const now = Date.now();
  for (const product of products ?? []) {
    if (product.status !== 'active' || !product.slug) continue;

    if (product.type !== 'experience') {
      entries.push({
        url: absoluteUrl(`/p/${product.slug}`),
        lastModified: lastModified(product.updated_at),
        changeFrequency: 'weekly',
        priority: 0.7,
      });
      continue;
    }

    const join = product.event;
    if (!join || !eventsKnown || hidden.has(join.id)) continue;
    if (!live.has(join.id)) {
      const startsAt = Date.parse(join.date);
      // Unparseable, or still ahead with no live row: cancelled, or withheld for
      // a reason the public API does not name. Either way it is not on sale.
      if (!Number.isFinite(startsAt) || startsAt > now) continue;
    }

    entries.push({
      url: absoluteUrl(`/experiences/${product.slug}`),
      lastModified: lastModified(product.updated_at),
      changeFrequency: live.has(join.id) ? 'daily' : 'yearly',
      priority: live.has(join.id) ? 0.7 : 0.4,
    });
  }

  return entries;
}
