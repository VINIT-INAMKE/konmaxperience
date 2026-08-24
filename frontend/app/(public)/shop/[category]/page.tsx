import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CatalogBreadcrumb } from '@/components/storefront/catalog/CatalogBreadcrumb';
import { CatalogSort } from '@/components/storefront/catalog/CatalogSort';
import { EmptyCatalog } from '@/components/storefront/catalog/EmptyCatalog';
import { FacetChips } from '@/components/storefront/catalog/FacetChips';
import { FacetSidebar } from '@/components/storefront/catalog/FacetSidebar';
import { LoadMore } from '@/components/storefront/catalog/LoadMore';
import { ProductGrid } from '@/components/storefront/catalog/ProductGrid';
import {
  activeCategories,
  fetchStorefrontCategories,
  fetchStorefrontProducts,
  findCategoryBySlug,
} from '@/components/storefront/catalog/catalog-data';
import {
  buildCategoryFacetGroup,
  buildSortOptions,
  buildTypeFacetGroup,
  CATALOG_PAGE_SIZE,
  CATALOG_SORT_SCAN_LIMIT,
  catalogHref,
  DEFAULT_CATALOG_SORT,
  productTypeLabel,
  readCatalogSort,
  readParam,
  readProductType,
  sortProducts,
  type FacetGroup,
  type HrefParams,
  type SearchParamsInput,
} from '@/components/storefront/catalog/catalog-model';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { metaDescription, SITE_NAME, storefrontMetadata } from '@/lib/seo/metadata';
import type { StorefrontCategory } from '@/lib/types/storefront';

/**
 * `/shop/[category]` — one shelf, named by its slug (`STORE-01`).
 *
 * **The slug is resolved through `GET /catalog/categories`, not guessed.** That
 * route is `@Public()`, returns a **bare array** (not the `{ items }` envelope),
 * and is cached 60 s on both sides — so resolving a slug costs nothing after the
 * first request, and an unknown slug reaches `notFound()` rather than rendering
 * an empty shelf under a made-up heading.
 *
 * **A failed fetch is not a 404.** `fetchStorefrontCategories` answers `null`
 * when the backend is unreachable; calling `notFound()` there would tell a
 * crawler the shelf is gone the next time the API blinks. The two cases are kept
 * apart: `null` renders the error state, an empty result renders `notFound()`.
 */
interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<SearchParamsInput>;
}

function categoryDescription(category: StorefrontCategory): string {
  return metaDescription(
    `${category.name} from the Konma villa kitchen — every price includes GST, and pantry orders ship across India.`,
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const query = await searchParams;
  const rows = await fetchStorefrontCategories(readParam(query, 'brand_id'));
  const category = rows ? findCategoryBySlug(rows, slug) : null;

  if (!category) {
    /**
     * The page body decides between `notFound()` and the error state; metadata
     * only has to avoid claiming a name it does not have — **and avoid
     * nominating a canonical for a URL that is about to 404.**
     *
     * `robots: { index: false, follow: false }` is the load-bearing half (P5b
     * Task 13). The storefront streams: `app/(public)/loading.tsx` opens a
     * Suspense boundary, so the response headers are on the wire before
     * `notFound()` throws and this route answers a **soft 404** — HTTP `200`
     * carrying the not-found body. Next injects its own `<meta name="robots"
     * content="noindex">` into that streamed markup, and this makes the refusal
     * explicit and adds `nofollow`, matching what `/p/[slug]` and
     * `/experiences/[slug]` already do for the identical case. Emitting the
     * previous indexable `Shop — Konma` card with a canonical of
     * `/shop/{unknown-slug}` invited a crawler to index every typo as a
     * duplicate of the shop.
     *
     * A backend outage lands here too, and the same answer is the right one: a
     * transient error page should not be indexed either. The route is dynamic,
     * so the noindex lasts exactly as long as the outage does.
     */
    return {
      title: `Shelf not found — ${SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  return storefrontMetadata({
    title: `${category.name} — ${SITE_NAME}`,
    description: categoryDescription(category),
    path: `/shop/${category.slug}`,
  });
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: slug } = await params;
  const query = await searchParams;

  const type = readProductType(query);
  const brandId = readParam(query, 'brand_id');
  const cursor = readParam(query, 'cursor');
  const sort = readCatalogSort(query);
  const isSorted = sort !== DEFAULT_CATALOG_SORT;

  const categoryRows = await fetchStorefrontCategories(brandId);

  if (categoryRows === null) {
    return (
      <StorefrontError
        title="We could not load this shelf"
        description="The shop is still here — this is on us. Try again in a moment."
        href="/shop"
        actionLabel="Back to the shop"
      />
    );
  }

  const category = findCategoryBySlug(categoryRows, slug);
  if (!category) notFound();

  const page = await fetchStorefrontProducts({
    type,
    category_id: category.id,
    cursor: isSorted ? undefined : cursor,
    limit: isSorted ? CATALOG_SORT_SCAN_LIMIT : CATALOG_PAGE_SIZE,
  });

  const path = `/shop/${category.slug}`;
  const current: HrefParams = {
    type,
    brand_id: brandId,
    sort: isSorted ? sort : null,
  };

  const siblings = activeCategories(categoryRows);
  const groups: FacetGroup[] = [
    buildTypeFacetGroup({ path, current, active: type }),
    ...(siblings.length > 0
      ? [
          buildCategoryFacetGroup({
            categories: siblings.map((row) => ({
              id: row.id,
              name: row.name,
              href: catalogHref(`/shop/${row.slug}`, {
                type,
                sort: isSorted ? sort : null,
              }),
              count: row._count?.products ?? null,
            })),
            activeId: category.id,
            clearHref: catalogHref('/shop', { type, sort: isSorted ? sort : null }),
          }),
        ]
      : []),
  ];

  const clearAllHref = path;
  const sortOptions = buildSortOptions(path, current, sort);
  const items = page ? sortProducts(page.items, sort) : [];
  const truncated = isSorted && page !== null && page.next_cursor !== null;

  const trail = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: category.name, path },
  ];

  return (
    <div className="space-y-8">
      <CatalogBreadcrumb trail={trail} />

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-strong sm:text-4xl">
          {category.name}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          {type
            ? `${productTypeLabel(type)} in ${category.name}. Every price includes GST.`
            : categoryDescription(category)}
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <FacetSidebar groups={groups} clearAllHref={clearAllHref} />

        <div className="space-y-6">
          <FacetChips groups={groups} clearAllHref={clearAllHref} />

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
            <p className="text-sm text-ink-muted">
              {page === null
                ? 'Shelf unavailable'
                : page.next_cursor !== null && !isSorted
                  ? `Showing the first ${items.length} products`
                  : `${items.length} ${items.length === 1 ? 'product' : 'products'}`}
            </p>
            <CatalogSort
              options={sortOptions}
              note={
                truncated
                  ? `Ordered across the first ${CATALOG_SORT_SCAN_LIMIT} products.`
                  : null
              }
            />
          </div>

          {page === null ? (
            <StorefrontError
              title="We could not load this shelf"
              description="The shop is still here — this is on us. Try again in a moment."
              href="/shop"
              actionLabel="Back to the shop"
            />
          ) : items.length === 0 ? (
            <EmptyCatalog
              scope={{ kind: 'category', categoryName: category.name, type }}
            />
          ) : (
            <ProductGrid items={items}>
              {!isSorted && page.next_cursor !== null ? (
                <LoadMore
                  mode="products"
                  query={{
                    category_id: category.id,
                    ...(type ? { type } : {}),
                  }}
                  initialCursor={page.next_cursor}
                  limit={CATALOG_PAGE_SIZE}
                  label="Load more products"
                />
              ) : null}
            </ProductGrid>
          )}
        </div>
      </div>
    </div>
  );
}
