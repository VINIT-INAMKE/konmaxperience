/**
 * The catalogue's pure model — search-param parsing, href building, the facet
 * shape and the sort rules. **No fetching and no JSX**, so a server page, a
 * server-safe facet renderer and the one client island can all import it
 * without dragging a data layer into the browser bundle.
 *
 * Two rules drive everything here:
 *
 * 1. **Filters live in the URL, never in client state** (plan Task 5). Every
 *    facet is a `<Link>` to a rebuilt query string, so `/shop?type=packaged` is
 *    shareable, back-button-correct and still server-rendered. That is why the
 *    only thing this file exports for a facet is a *href*, not a handler.
 * 2. **The backend orders by `name asc` and pages on a `name + id` cursor**
 *    (`catalog.service.ts:listArgs`). There is no `sort` query parameter, so any
 *    order other than the server's own cannot be paged through — see
 *    {@link CATALOG_SORT_SCAN_LIMIT}.
 */

import {
  PRODUCT_TYPE_LABELS,
  type FulfilmentType,
  type ProductType,
} from '@/lib/types/catalog';
import type {
  StorefrontProduct,
  StorefrontVariant,
} from '@/lib/types/storefront';

// ─── search params ──────────────────────────────────────────────────────────

/** Next's `searchParams`, once awaited. */
export type SearchParamsInput = Record<string, string | string[] | undefined>;

/**
 * One parameter as a trimmed string, or `undefined`.
 *
 * A repeated parameter (`?type=a&type=b`) arrives as an array; the first entry
 * wins rather than the request being rejected, because a hand-edited URL must
 * degrade to a narrower page, never to a 500.
 */
export function readParam(
  params: SearchParamsInput,
  key: string,
): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' ? undefined : trimmed;
}

/** The four `ProductType`s, in the order the storefront presents them. */
export const CATALOG_TYPE_ORDER: readonly ProductType[] = [
  'prepared_food',
  'packaged',
  'experience',
  'merchandise',
] as const;

export function isProductType(value: string | undefined): value is ProductType {
  return (
    value !== undefined &&
    (CATALOG_TYPE_ORDER as readonly string[]).includes(value)
  );
}

/**
 * An unrecognised `?type=` is **dropped, not rejected**: a stale link from a
 * renamed type should land on the whole shop rather than on a 404.
 */
export function readProductType(
  params: SearchParamsInput,
): ProductType | undefined {
  const value = readParam(params, 'type');
  return isProductType(value) ? value : undefined;
}

// ─── copy ───────────────────────────────────────────────────────────────────

/**
 * Per-type page copy. The empty line is deliberately specific — `DESIGN-03`
 * asks for "No products in Pantry yet", never "Nothing here".
 */
export const CATALOG_TYPE_COPY: Record<
  ProductType,
  { heading: string; blurb: string; empty: string }
> = {
  prepared_food: {
    heading: 'Prepared food',
    blurb:
      'Cooked in the villa kitchen and handed over the same day — collection or local delivery.',
    empty: 'The kitchen has nothing on the pass right now.',
  },
  packaged: {
    heading: 'Pantry',
    blurb:
      'Preserves, ferments and larder staples, packed at the villa and shipped across India.',
    empty: 'No pantry jars on the shelf yet.',
  },
  experience: {
    heading: 'Experiences',
    blurb:
      'Suppers, tastings and workshops at the villa. Every sitting has a date and a seat count.',
    empty: 'No sittings are open for booking yet.',
  },
  merchandise: {
    heading: 'Merchandise',
    blurb: 'Ceramics, aprons and kit from the villa kitchen, shipped across India.',
    empty: 'No merchandise in stock yet.',
  },
};

/** The one-line availability promise a card makes, from `Product.fulfilment`. */
export const FULFILMENT_NOTE: Record<FulfilmentType, string> = {
  local: 'Collection or local delivery',
  shipped: 'Ships across India',
  booking: 'Reserved for a sitting',
};

/** `prepared_food` → `Prepared food`. Re-exported so a card imports one module. */
export function productTypeLabel(type: ProductType): string {
  return PRODUCT_TYPE_LABELS[type];
}

// ─── paging ─────────────────────────────────────────────────────────────────

/**
 * One page of the grid. Four columns at `xl`, so 24 fills six clean rows and
 * leaves an obvious "Load more" rather than a ragged last row.
 */
export const CATALOG_PAGE_SIZE = 24;

/**
 * The page size used when a **non-default sort** is active.
 *
 * `catalog.service.ts` sorts by `name asc` and pages on `{ name, id }`. Ordering
 * by price or rating therefore cannot be paged: page 2's cursor would step
 * through the *name* order, so the merged list would be neither price-ordered
 * nor complete. Rather than ship a sort that lies, a sorted view fetches the
 * backend's maximum page (`LIST_LIMIT_MAX = 200`) in one request and orders the
 * whole set, and {@link CatalogSortKey} `curated` — the server's own order — is
 * the only view that pages. A catalogue that outgrows 200 rows per filter needs
 * a real `sort` parameter on the backend, and the UI says so instead of
 * pretending.
 */
export const CATALOG_SORT_SCAN_LIMIT = 200;

// ─── sort ───────────────────────────────────────────────────────────────────

export type CatalogSortKey = 'curated' | 'price_asc' | 'price_desc' | 'rating';

export const DEFAULT_CATALOG_SORT: CatalogSortKey = 'curated';

export const CATALOG_SORT_LABELS: Record<CatalogSortKey, string> = {
  curated: 'Curated',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Best rated',
};

export const CATALOG_SORT_ORDER: readonly CatalogSortKey[] = [
  'curated',
  'price_asc',
  'price_desc',
  'rating',
] as const;

export function isCatalogSort(
  value: string | undefined,
): value is CatalogSortKey {
  return (
    value !== undefined &&
    (CATALOG_SORT_ORDER as readonly string[]).includes(value)
  );
}

export function readCatalogSort(params: SearchParamsInput): CatalogSortKey {
  const value = readParam(params, 'sort');
  return isCatalogSort(value) ? value : DEFAULT_CATALOG_SORT;
}

/**
 * The cheapest variant, by `price_delta`. **May be negative** — a smaller jar
 * costs less than the default — which is why the grid prices "from" the
 * cheapest rather than from `base_price`.
 */
export function cheapestVariant(
  product: Pick<StorefrontProduct, 'variants'>,
): StorefrontVariant | null {
  const variants = product.variants ?? [];
  if (variants.length === 0) return null;
  return variants.reduce((min, v) => (v.price_delta < min.price_delta ? v : min));
}

/** The figure a card leads with: `base_price` plus the cheapest delta. Rupees, GST included. */
export function displayPrice(product: StorefrontProduct): number {
  return Number(
    (product.base_price + (cheapestVariant(product)?.price_delta ?? 0)).toFixed(2),
  );
}

/**
 * Orders a page **without mutating it**. `curated` returns the server's order
 * untouched, which is the only order the cursor can page through.
 */
export function sortProducts(
  items: readonly StorefrontProduct[],
  key: CatalogSortKey,
): StorefrontProduct[] {
  const rows = [...items];
  switch (key) {
    case 'price_asc':
      return rows.sort((a, b) => displayPrice(a) - displayPrice(b));
    case 'price_desc':
      return rows.sort((a, b) => displayPrice(b) - displayPrice(a));
    case 'rating':
      // An unrated product is `rating_avg: null`, not `0` — it sorts below a
      // one-star product rather than beside it, because "no opinion yet" and
      // "everybody hated it" are not the same claim.
      return rows.sort((a, b) => {
        const byScore = (b.rating_avg ?? -1) - (a.rating_avg ?? -1);
        return byScore !== 0 ? byScore : b.rating_count - a.rating_count;
      });
    default:
      return rows;
  }
}

// ─── hrefs ──────────────────────────────────────────────────────────────────

/** A query value of `undefined`, `null` or `''` is omitted, so hrefs stay short. */
export type HrefParams = Record<string, string | null | undefined>;

export function catalogHref(path: string, params: HrefParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query === '' ? path : `${path}?${query}`;
}

/**
 * A facet link: the current query with **one** key flipped, and `cursor`
 * always dropped — narrowing a filter while holding a page cursor would land
 * the visitor in the middle of a list they have not seen the start of.
 */
export function facetHref(
  path: string,
  current: HrefParams,
  key: string,
  value: string | null,
): string {
  return catalogHref(path, { ...current, cursor: null, [key]: value });
}

// ─── facets ─────────────────────────────────────────────────────────────────

/**
 * One facet choice, already resolved to a link. Both renderers — the `lg`
 * sidebar and the small-screen chip row — take this shape, so `/shop` (whose
 * facets come from `GET /catalog/categories`) and `/search` (whose facets come
 * from the envelope, with counts) render through identical components.
 */
export interface FacetOption {
  id: string;
  label: string;
  href: string;
  /** `null` where the source has no count — `/catalog/categories` gives none per type. */
  count?: number | null;
  active: boolean;
}

export interface FacetGroup {
  id: string;
  label: string;
  options: FacetOption[];
  /** Rendered as "All" / "Clear" when at least one option in the group is active. */
  clearHref?: string | null;
}

/** True when any option in any group is on — drives the "Clear all" affordance. */
export function hasActiveFacet(groups: readonly FacetGroup[]): boolean {
  return groups.some((group) => group.options.some((option) => option.active));
}

/**
 * The product-type facet, shared by `/shop`, `/shop/[category]` and `/search`.
 *
 * `counts` is optional because only `/search` has any: `GET /catalog/search`
 * returns `facets.types` counted over the text predicate, while
 * `GET /catalog/categories` counts products per *category* and knows nothing
 * about types. A facet with no count renders as a plain label rather than
 * inventing a zero.
 *
 * When `counts` is supplied, only the types that actually have hits are offered
 * — a facet leading to a guaranteed-empty page is worse than no facet.
 */
export function buildTypeFacetGroup(options: {
  path: string;
  current: HrefParams;
  active?: ProductType | undefined;
  counts?: ReadonlyMap<ProductType, number> | null;
}): FacetGroup {
  const { path, current, active, counts } = options;
  const types = counts
    ? CATALOG_TYPE_ORDER.filter((type) => (counts.get(type) ?? 0) > 0)
    : CATALOG_TYPE_ORDER;

  return {
    id: 'type',
    label: 'Type',
    clearHref: facetHref(path, current, 'type', null),
    options: types.map((type) => ({
      id: type,
      label: PRODUCT_TYPE_LABELS[type],
      href: facetHref(path, current, 'type', type),
      count: counts ? (counts.get(type) ?? 0) : null,
      active: active === type,
    })),
  };
}

/** The shape both facet sources reduce to before they become a category group. */
export interface CategoryFacetSource {
  id: string;
  name: string;
  /** The href this option navigates to — a slug route on `/shop`, a query on `/search`. */
  href: string;
  count?: number | null;
}

export function buildCategoryFacetGroup(options: {
  categories: readonly CategoryFacetSource[];
  activeId?: string | null;
  clearHref: string;
}): FacetGroup {
  const { categories, activeId, clearHref } = options;
  return {
    id: 'category',
    label: 'Category',
    clearHref,
    options: categories.map((category) => ({
      id: category.id,
      label: category.name,
      href: category.href,
      count: category.count ?? null,
      active: activeId === category.id,
    })),
  };
}

/** The sort control's links, with the current key marked. */
export function buildSortOptions(
  path: string,
  current: HrefParams,
  active: CatalogSortKey,
): { key: CatalogSortKey; href: string; active: boolean }[] {
  return CATALOG_SORT_ORDER.map((key) => ({
    key,
    href: catalogHref(path, {
      ...current,
      cursor: null,
      sort: key === DEFAULT_CATALOG_SORT ? null : key,
    }),
    active: key === active,
  }));
}
