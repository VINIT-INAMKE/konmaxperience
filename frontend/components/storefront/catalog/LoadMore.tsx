'use client';

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { SearchResultCard } from '@/components/storefront/search/SearchResultCard';
import { Button } from '@/components/ui/button';
import type {
  CatalogSearchHit,
  SearchEnvelope,
  StorefrontProduct,
  StorefrontProductPage,
} from '@/lib/types/storefront';

import { StorefrontProductCard } from './StorefrontProductCard';

/**
 * The catalogue's **only** client island (plan Task 5).
 *
 * ## Why the cursor is not written into the browser's URL
 *
 * The plan's wording — "appends pages by pushing `?cursor=` and merges results"
 * — is about the *request*, and that is how it is implemented: each click issues
 * `?cursor=<opaque>` to the API and merges the answer into the list. The cursor
 * is deliberately **not** pushed into `window.location`, and the reason is the
 * same one that puts every facet *in* the URL: shareability. A facet URL
 * describes a set; a cursor URL describes a position inside one. Pushing
 * `?cursor=` would make a shared `/shop?cursor=abc` link open on page four with
 * pages one to three missing, and a `router.push` would re-render the server
 * page with only that slice — discarding the merged list this component exists
 * to build. Both `/shop` and `/search` still *accept* `?cursor=` on the server
 * (the plan requires it), so a deep link built by hand or by a crawler works;
 * nothing here writes one.
 *
 * ## Why a raw `fetch` and not `apiClient`
 *
 * `apiClient` attaches the staff cookie and redirects to `/team` on a 401. Both
 * catalogue routes are `@Public()`, so an anonymous shopper must not be able to
 * trip a staff redirect by clicking "Load more".
 *
 * ## Why it renders a fragment
 *
 * The appended cards are direct children of the parent grid, and the button sits
 * on its own `col-span-full` row inside the same grid — so page two lines up
 * with page one instead of starting a second, mis-aligned grid below it.
 */
export type LoadMoreMode = 'products' | 'search';

export interface LoadMoreProps {
  mode: LoadMoreMode;
  /**
   * The API query for the *next* page, minus `cursor` — exactly the filters the
   * server page used, so page two is drawn from the same set as page one.
   */
  query: Record<string, string>;
  /** `next_cursor` from the server-rendered page. `null` means there is no page two. */
  initialCursor: string | null;
  /** Rows per click. Defaults to the page size the server used. */
  limit?: number;
  label?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ENDPOINT: Record<LoadMoreMode, string> = {
  products: '/catalog/products',
  search: '/catalog/search',
};

export function LoadMore({
  mode,
  query,
  initialCursor,
  limit,
  label = 'Load more',
}: LoadMoreProps) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [hits, setHits] = useState<CatalogSearchHit[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNext = useCallback(async () => {
    if (cursor === null || pending) return;
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams(query);
      params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));
      const response = await fetch(
        `${API_BASE_URL}${ENDPOINT[mode]}?${params.toString()}`,
        { headers: { accept: 'application/json' } },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = (await response.json()) as StorefrontProductPage | SearchEnvelope;
      if (!Array.isArray(page.items)) throw new Error('Unexpected response');

      if (mode === 'products') {
        const rows = page.items as StorefrontProduct[];
        // The backend pages on `{ name, id }` with `skip: 1`, so a repeat is a
        // backend fault rather than a normal race — but a duplicate React key
        // would break the whole grid, so the merge de-duplicates regardless.
        setProducts((previous) => mergeById(previous, rows));
      } else {
        setHits((previous) => mergeById(previous, page.items as CatalogSearchHit[]));
      }
      setCursor(page.next_cursor ?? null);
    } catch {
      setError('We could not load more just now. Try again.');
    } finally {
      setPending(false);
    }
  }, [cursor, limit, mode, pending, query]);

  const appended = mode === 'products' ? products.length : hits.length;
  if (cursor === null && appended === 0) return null;

  return (
    <>
      {products.map((product) => (
        <StorefrontProductCard key={product.id} product={product} />
      ))}
      {hits.map((hit) => (
        <SearchResultCard key={hit.id} hit={hit} />
      ))}

      <div className="col-span-full flex flex-col items-center gap-2 pt-2">
        {cursor !== null ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => void loadNext()}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {pending ? 'Loading…' : label}
          </Button>
        ) : (
          <p className="text-xs text-ink-faint">That is everything.</p>
        )}
        {error ? (
          <p role="alert" className="text-xs text-serious">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}

/** Appends `incoming`, dropping any row already on screen. */
function mergeById<T extends { id: string }>(
  previous: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set(previous.map((row) => row.id));
  return [...previous, ...incoming.filter((row) => !seen.has(row.id))];
}
