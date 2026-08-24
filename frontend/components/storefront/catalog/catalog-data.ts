/**
 * Server-side loaders for the three public catalogue routes.
 *
 * **Why raw `fetch` and never `apiClient`:** `apiClient` is cookie-bound and
 * browser-only — it redirects to `/team` when a staff session is stale, which is
 * nonsense on a storefront page and impossible in a server component. All three
 * routes here are `@Public()`, so a plain `fetch` is both correct and cacheable.
 *
 * **`revalidate: 60` matches the backend's own cache.** `CatalogCacheService`
 * wraps `findProductsPublic`, `findCategories` and `search` for 60 s and
 * invalidates on every catalogue write, so a longer Next cache would out-live
 * the invalidation and a shorter one would just miss.
 *
 * **A failure returns `null`, it does not throw.** A thrown fetch in a server
 * component pops the route-group error boundary and replaces the whole page —
 * including the header and the customer's cart button — with an apology. The
 * pages render `StorefrontError` inside the content well instead, which keeps
 * the shell alive and the cart reachable. `null` is also what a build machine
 * with no backend gets, so `next build` renders the shell rather than failing.
 */

import type {
  SearchEnvelope,
  StorefrontCategory,
  StorefrontProductPage,
} from '@/lib/types/storefront';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Matches `CatalogCacheService`'s own TTL. */
export const CATALOG_REVALIDATE_SECONDS = 60;

async function fetchCatalogJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS },
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // No backend (a build machine), DNS, a timeout — the caller renders an error
    // state inside the shell instead of losing the page.
    return null;
  }
}

/** The query `GET /catalog/products` understands. Empty values are omitted. */
export interface CatalogProductQuery {
  type?: string;
  category_id?: string;
  brand_id?: string;
  cursor?: string;
  limit?: number;
}

export function catalogProductSearch(query: CatalogProductQuery): string {
  const params = new URLSearchParams();
  if (query.category_id) params.set('category_id', query.category_id);
  if (query.brand_id) params.set('brand_id', query.brand_id);
  if (query.type) params.set('type', query.type);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));
  return params.toString();
}

/** `GET /catalog/products` → `{ items, next_cursor }`. `null` on any failure. */
export async function fetchStorefrontProducts(
  query: CatalogProductQuery,
): Promise<StorefrontProductPage | null> {
  const search = catalogProductSearch(query);
  const page = await fetchCatalogJson<StorefrontProductPage>(
    `/catalog/products${search === '' ? '' : `?${search}`}`,
  );
  // A backend that answered with something other than the envelope is a
  // contract break, not an empty catalogue — surface it as a failure.
  return page && Array.isArray(page.items) ? page : null;
}

/** `GET /catalog/categories` → a **bare array**, not an envelope. `null` on failure. */
export async function fetchStorefrontCategories(
  brandId?: string,
): Promise<StorefrontCategory[] | null> {
  const rows = await fetchCatalogJson<StorefrontCategory[]>(
    `/catalog/categories${brandId ? `?brand_id=${encodeURIComponent(brandId)}` : ''}`,
  );
  return Array.isArray(rows) ? rows : null;
}

/** Active categories only, in `sort_order` — archived rows are already withheld server-side. */
export function activeCategories(
  rows: readonly StorefrontCategory[],
): StorefrontCategory[] {
  return rows.filter((row) => row.status === 'active' && row.slug !== '');
}

/**
 * Resolves a `/shop/[category]` slug.
 *
 * Slugs are unique per brand rather than globally, so a duplicate resolves to
 * the first in `sort_order` — the same row the header's Shop menu links to.
 */
export function findCategoryBySlug(
  rows: readonly StorefrontCategory[],
  slug: string,
): StorefrontCategory | null {
  const wanted = slug.toLowerCase();
  return (
    activeCategories(rows).find((row) => row.slug.toLowerCase() === wanted) ?? null
  );
}

export interface CatalogSearchQuery {
  q: string;
  type?: string;
  category_id?: string;
  cursor?: string;
  limit?: number;
}

export function catalogSearchSearch(query: CatalogSearchQuery): string {
  const params = new URLSearchParams();
  params.set('q', query.q);
  if (query.type) params.set('type', query.type);
  if (query.category_id) params.set('category_id', query.category_id);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));
  return params.toString();
}

/**
 * `GET /catalog/search` → `{ items, facets, next_cursor }`.
 *
 * An empty `q` never reaches the network: the backend answers it with an empty
 * envelope and the page renders the search prompt, so the round-trip would buy
 * nothing.
 */
export async function fetchStorefrontSearch(
  query: CatalogSearchQuery,
): Promise<SearchEnvelope | null> {
  if (query.q.trim() === '') {
    return { items: [], facets: { types: [], categories: [] }, next_cursor: null };
  }
  const envelope = await fetchCatalogJson<SearchEnvelope>(
    `/catalog/search?${catalogSearchSearch(query)}`,
  );
  if (!envelope || !Array.isArray(envelope.items)) return null;
  return {
    items: envelope.items,
    // Facets are the page's filter UI; a malformed block must not crash the
    // results the visitor came for.
    facets: {
      types: Array.isArray(envelope.facets?.types) ? envelope.facets.types : [],
      categories: Array.isArray(envelope.facets?.categories)
        ? envelope.facets.categories
        : [],
    },
    next_cursor: envelope.next_cursor ?? null,
  };
}
