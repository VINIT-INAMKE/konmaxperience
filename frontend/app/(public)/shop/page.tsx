import type { Metadata } from 'next';

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
} from '@/components/storefront/catalog/catalog-data';
import {
  buildCategoryFacetGroup,
  buildSortOptions,
  buildTypeFacetGroup,
  CATALOG_PAGE_SIZE,
  CATALOG_SORT_SCAN_LIMIT,
  CATALOG_TYPE_COPY,
  catalogHref,
  DEFAULT_CATALOG_SORT,
  readCatalogSort,
  readParam,
  readProductType,
  sortProducts,
  type FacetGroup,
  type HrefParams,
  type SearchParamsInput,
} from '@/components/storefront/catalog/catalog-model';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { SITE_NAME, storefrontMetadata } from '@/lib/seo/metadata';

/**
 * `/shop` — the catalogue (`STORE-01`).
 *
 * **A server component, with no client directive anywhere in this file.** The
 * data is fetched here with `next: { revalidate: 60 }`, matching the backend's
 * own `CatalogCacheService` TTL, and every filter is read from the URL — so the
 * generated `<title>`, the grid and the breadcrumb are all in the server HTML a
 * crawler receives. The only JavaScript this route ships is `LoadMore` and the
 * quick-add button.
 *
 * **`?type=prepared_food` is the target of the `/menu` redirect** (P5b decision
 * 20), so that URL must keep producing the prepared-food shelf. It is also the
 * one facet worth ranking, which is why it — and only it — is carried into the
 * canonical URL; `category_id`, `brand_id`, `sort` and `cursor` describe a slice
 * of the same set, and the slugged `/shop/[category]` route is the indexable way
 * to name a shelf.
 */
interface ShopPageProps {
  searchParams: Promise<SearchParamsInput>;
}

const SHOP_BLURB =
  'Everything the villa kitchen makes — food cooked to order, pantry jars shipped across India, seats at the table and kit from the kitchen. Every price includes GST.';

export async function generateMetadata({
  searchParams,
}: ShopPageProps): Promise<Metadata> {
  const params = await searchParams;
  const type = readProductType(params);
  const copy = type ? CATALOG_TYPE_COPY[type] : null;

  return storefrontMetadata({
    title: copy ? `${copy.heading} — ${SITE_NAME}` : `Shop — ${SITE_NAME}`,
    description: copy?.blurb ?? SHOP_BLURB,
    path: type ? `/shop?type=${type}` : '/shop',
  });
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const type = readProductType(params);
  const categoryId = readParam(params, 'category_id');
  const brandId = readParam(params, 'brand_id');
  const cursor = readParam(params, 'cursor');
  const sort = readCatalogSort(params);
  const isSorted = sort !== DEFAULT_CATALOG_SORT;

  const [page, categoryRows] = await Promise.all([
    fetchStorefrontProducts({
      type,
      category_id: categoryId,
      brand_id: brandId,
      // A non-default order cannot be paged through the name cursor, so a
      // sorted view fetches the backend's maximum page and orders all of it.
      cursor: isSorted ? undefined : cursor,
      limit: isSorted ? CATALOG_SORT_SCAN_LIMIT : CATALOG_PAGE_SIZE,
    }),
    fetchStorefrontCategories(brandId),
  ]);

  const copy = type ? CATALOG_TYPE_COPY[type] : null;
  const heading = copy?.heading ?? 'Shop';
  const trail = [
    { name: 'Home', path: '/' },
    ...(copy ? [{ name: 'Shop', path: '/shop' }] : []),
    { name: heading, path: type ? `/shop?type=${type}` : '/shop' },
  ];

  // Carried across every facet and sort link, so narrowing one filter never
  // silently drops another.
  const current: HrefParams = {
    type,
    category_id: categoryId,
    brand_id: brandId,
    sort: isSorted ? sort : null,
  };

  const categories = categoryRows ? activeCategories(categoryRows) : [];
  const groups: FacetGroup[] = [
    buildTypeFacetGroup({ path: '/shop', current, active: type }),
    ...(categories.length > 0
      ? [
          buildCategoryFacetGroup({
            // A category has a slug and therefore a canonical, indexable route —
            // the facet links there rather than to `?category_id=`, which the
            // route still accepts for deep links and API parity.
            categories: categories.map((category) => ({
              id: category.id,
              name: category.name,
              href: catalogHref(`/shop/${category.slug}`, {
                type,
                sort: isSorted ? sort : null,
              }),
              count: category._count?.products ?? null,
            })),
            activeId: categoryId ?? null,
            clearHref: catalogHref('/shop', { type, sort: isSorted ? sort : null }),
          }),
        ]
      : []),
  ];

  const clearAllHref = '/shop';
  const sortOptions = buildSortOptions('/shop', current, sort);

  const items = page ? sortProducts(page.items, sort) : [];
  const hasFilter = Boolean(type || categoryId || brandId);
  const truncated = isSorted && page !== null && page.next_cursor !== null;

  return (
    <div className="space-y-8">
      <CatalogBreadcrumb trail={trail} />

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-strong sm:text-4xl">
          {heading}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          {copy?.blurb ?? SHOP_BLURB}
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <FacetSidebar groups={groups} clearAllHref={clearAllHref} />

        <div className="space-y-6">
          <FacetChips groups={groups} clearAllHref={clearAllHref} />

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
            <p className="text-sm text-ink-muted">
              {page === null
                ? 'Catalogue unavailable'
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
              title="We could not load the catalogue"
              description="The shop is still here — this is on us. Try again in a moment."
              href="/shop"
              actionLabel="Reload the shop"
            />
          ) : items.length === 0 ? (
            hasFilter && !type ? (
              <EmptyCatalog scope={{ kind: 'filtered', clearHref: clearAllHref }} />
            ) : (
              <EmptyCatalog scope={{ kind: 'shop', type }} />
            )
          ) : (
            <ProductGrid items={items}>
              {!isSorted && page.next_cursor !== null ? (
                <LoadMore
                  mode="products"
                  query={{
                    ...(type ? { type } : {}),
                    ...(categoryId ? { category_id: categoryId } : {}),
                    ...(brandId ? { brand_id: brandId } : {}),
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
