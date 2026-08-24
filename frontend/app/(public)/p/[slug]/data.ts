import { cache } from 'react';

import type { ProductReviewPage, StorefrontProduct } from '@/lib/types/storefront';

/**
 * Server-side loaders for `/p/[slug]`.
 *
 * **Why raw `fetch` and not `apiClient`:** `apiClient` is cookie-bound and
 * browser-only — on a `401` it clears the staff auth store and sends the tab to
 * `/team`, which is precisely the wrong thing to do to an anonymous shopper.
 * Both routes here are `@Public()`, so the page talks to them directly and gets
 * Next's data cache for free. `revalidate: 60` matches the backend's own 60 s
 * `CatalogCacheService` window, so the two caches expire together rather than
 * the edge serving something the origin has already forgotten.
 *
 * **`cache()` is load-bearing.** `generateMetadata` and the page body both need
 * the product, and Next runs them as two separate calls. React's request-scoped
 * memo collapses that into one fetch per request; without it every product page
 * would hit the backend twice for identical bytes.
 *
 * **A `404` and a failure are different answers.** A missing slug returns `null`
 * and the page calls `notFound()` — the correct signal to a crawler that the URL
 * is gone. Any other failure *throws*, so `app/(public)/error.tsx` shows the
 * storefront error state and the route keeps answering `500`. Collapsing the two
 * would tell Google to deindex a live product every time the backend hiccups.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Matches `CatalogCacheService`'s own TTL. */
export const CATALOG_REVALIDATE_SECONDS = 60;

/** How many published reviews the server renders before the client paginates. */
export const REVIEWS_PAGE_SIZE = 10;

/**
 * `GET /catalog/products/slug/:slug`.
 *
 * `null` means the backend answered `404` — the slug is unknown, draft or
 * archived (`findProductBySlug` refuses anything that is not `active`).
 */
export const getProductBySlug = cache(
  async (slug: string): Promise<StorefrontProduct | null> => {
    const response = await fetch(
      `${API_BASE_URL}/catalog/products/slug/${encodeURIComponent(slug)}`,
      { next: { revalidate: CATALOG_REVALIDATE_SECONDS } },
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `GET /catalog/products/slug/${slug} answered ${response.status}`,
      );
    }
    return (await response.json()) as StorefrontProduct;
  },
);

/**
 * The same fetch, but a transport failure resolves to `null` instead of
 * throwing. `generateMetadata` runs before the page body and a throw there
 * escapes the route's own error boundary, so the metadata pass degrades to the
 * generic card and lets the page render the real error.
 */
export const getProductBySlugSafe = cache(
  async (slug: string): Promise<StorefrontProduct | null> => {
    try {
      return await getProductBySlug(slug);
    } catch {
      return null;
    }
  },
);

/**
 * `GET /catalog/products/:id/reviews` — published rows only.
 *
 * **Failure is not an error here.** Reviews are a section of the page, not the
 * page: a reviews outage must not take a buyable product offline, so this
 * degrades to an empty page and the section renders its empty state.
 */
export const getProductReviews = cache(
  async (productId: string): Promise<ProductReviewPage> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/catalog/products/${productId}/reviews?limit=${REVIEWS_PAGE_SIZE}`,
        { next: { revalidate: CATALOG_REVALIDATE_SECONDS } },
      );
      if (!response.ok) return { items: [], next_cursor: null };
      return (await response.json()) as ProductReviewPage;
    } catch {
      return { items: [], next_cursor: null };
    }
  },
);
