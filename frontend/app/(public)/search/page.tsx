import type { Metadata } from 'next';

import { FacetChips } from '@/components/storefront/catalog/FacetChips';
import { FacetSidebar } from '@/components/storefront/catalog/FacetSidebar';
import { LoadMore } from '@/components/storefront/catalog/LoadMore';
import { EmptyCatalog } from '@/components/storefront/catalog/EmptyCatalog';
import { fetchStorefrontSearch } from '@/components/storefront/catalog/catalog-data';
import {
  buildCategoryFacetGroup,
  buildTypeFacetGroup,
  catalogHref,
  readParam,
  readProductType,
  type FacetGroup,
  type HrefParams,
  type SearchParamsInput,
} from '@/components/storefront/catalog/catalog-model';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { SearchInput } from '@/components/storefront/search/SearchInput';
import { SearchPrompt } from '@/components/storefront/search/SearchPrompt';
import { SearchResultGrid } from '@/components/storefront/search/SearchResultGrid';
import { SITE_NAME, storefrontMetadata } from '@/lib/seo/metadata';
import type { ProductType } from '@/lib/types/catalog';

/**
 * `/search` — full-text search over the catalogue (`SRCH-01`).
 *
 * **A server component.** The query, the type filter and the category filter all
 * live in the URL, so a result page is shareable and the back button unwinds one
 * filter at a time. The only client code is the query field and `LoadMore`.
 *
 * **`index: false`, `follow: true`.** A query-string result page is not a
 * canonical URL and must not compete with `/shop` or `/p/[slug]` in an index —
 * but the links *out* of it point at pages that should be crawled, so this is a
 * `noindex`, not a `noindex,nofollow`. (That is why the metadata is assembled
 * here rather than through `storefrontMetadata`'s `noIndex` flag, which sets
 * both.)
 *
 * **An empty `q` is a prompt, not an error.** `catalog.service.ts:search`
 * short-circuits a blank term to an empty envelope; the page shows the four
 * shelves as a starting point.
 *
 * **The facets are counted without the active filters.** The backend counts them
 * over the text predicate alone, so they describe what the visitor could still
 * narrow to, not what they already narrowed to — which is why a facet's count
 * does not shrink when you click a different one.
 */
interface SearchPageProps {
  searchParams: Promise<SearchParamsInput>;
}

/** `catalog.service.ts`'s `SEARCH_LIMIT_DEFAULT`. Ranking degrades fast past this. */
const SEARCH_PAGE_SIZE = 20;

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = readParam(params, 'q');

  return {
    ...storefrontMetadata({
      title: q ? `Search: ${q} — ${SITE_NAME}` : `Search — ${SITE_NAME}`,
      description:
        'Search everything the villa kitchen makes — prepared food, pantry jars, experiences and merchandise.',
      path: '/search',
    }),
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = readParam(params, 'q') ?? '';
  const type = readProductType(params);
  const categoryId = readParam(params, 'category_id');
  const cursor = readParam(params, 'cursor');

  const envelope = await fetchStorefrontSearch({
    q,
    type,
    category_id: categoryId,
    cursor,
    limit: SEARCH_PAGE_SIZE,
  });

  const current: HrefParams = { q, type, category_id: categoryId };
  const clearAllHref = catalogHref('/search', { q });

  const typeCounts = new Map<ProductType, number>(
    (envelope?.facets.types ?? []).map((facet) => [facet.type, facet.count]),
  );

  const groups: FacetGroup[] =
    envelope === null || q === ''
      ? []
      : [
          buildTypeFacetGroup({
            path: '/search',
            current,
            active: type,
            counts: typeCounts,
          }),
          ...(envelope.facets.categories.length > 0
            ? [
                buildCategoryFacetGroup({
                  categories: envelope.facets.categories.map((facet) => ({
                    id: facet.category_id,
                    name: facet.name,
                    href: catalogHref('/search', {
                      q,
                      type,
                      category_id: facet.category_id,
                    }),
                    count: facet.count,
                  })),
                  activeId: categoryId ?? null,
                  clearHref: catalogHref('/search', { q, type }),
                }),
              ]
            : []),
        ];

  const hits = envelope?.items ?? [];

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-strong sm:text-4xl">
          Search
        </h1>
        {/* `key` remounts the field on a back-navigation, so the box always shows
            the query the page was actually rendered for — no effect-based sync. */}
        <SearchInput key={q} initialQuery={q} className="max-w-2xl" />
      </header>

      {q === '' ? (
        <SearchPrompt />
      ) : envelope === null ? (
        <StorefrontError
          title="Search is unavailable"
          description="We could not reach the catalogue just now. The shelves are still browsable."
          href="/shop"
          actionLabel="Browse the shop"
        />
      ) : hits.length === 0 ? (
        <EmptyCatalog scope={{ kind: 'search', query: q }} />
      ) : (
        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
          <FacetSidebar groups={groups} clearAllHref={clearAllHref} />

          <div className="space-y-6">
            <FacetChips groups={groups} clearAllHref={clearAllHref} />

            <p className="border-b border-line pb-3 text-sm text-ink-muted">
              {envelope.next_cursor !== null
                ? `Showing the first ${hits.length} results for “${q}”`
                : `${hits.length} ${hits.length === 1 ? 'result' : 'results'} for “${q}”`}
            </p>

            <SearchResultGrid hits={hits}>
              {envelope.next_cursor !== null ? (
                <LoadMore
                  mode="search"
                  query={{
                    q,
                    ...(type ? { type } : {}),
                    ...(categoryId ? { category_id: categoryId } : {}),
                  }}
                  initialCursor={envelope.next_cursor}
                  limit={SEARCH_PAGE_SIZE}
                  label="Load more results"
                />
              ) : null}
            </SearchResultGrid>
          </div>
        </div>
      )}
    </div>
  );
}
