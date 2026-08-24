/**
 * The **public** catalog shapes, deliberately kept apart from `catalog.ts`.
 *
 * `catalog.ts`'s `Product` mirrors `CatalogService`'s `STAFF_INCLUDE`, which
 * carries the recipe's cost and yield figures. The public routes use
 * `PUBLIC_INCLUDE` (`backend/src/catalog/catalog.service.ts`), which trims the
 * recipe to `{ id, preparation_type }` and the variants to
 * `{ id, name, sku, price_delta, is_default }` — `CAT-03` asserts that cost,
 * yield, BOM and margin never leave the server on a public route.
 *
 * Declaring `StorefrontProduct` without those fields is what makes the rule
 * enforceable in the editor: a storefront component cannot reference a cost it
 * was never given.
 */

import type {
  FulfilmentType,
  ProductMedia,
  ProductStatus,
  ProductType,
  StockMode,
} from './catalog';
import type { PreparationType } from './recipe';

/**
 * Every public list route answers with this envelope (`{ items, next_cursor }`),
 * **not** a bare array — `GET /catalog/products` changed shape in P5a.
 *
 * `next_cursor` is opaque. `/catalog/products` returns the last row's id;
 * `/catalog/search` returns a base64 offset (P5b decision 21). Neither is ever
 * parsed by the frontend: it is passed back verbatim as `?cursor=`.
 */
export interface CatalogEnvelope<T> {
  items: T[];
  next_cursor: string | null;
}

/** A variant as the public product route exposes it — no stock, no thresholds. */
export interface StorefrontVariant {
  id: string;
  name: string;
  sku: string;
  /** Added to `base_price`; may be negative. Rupees. */
  price_delta: number;
  is_default: boolean;
}

/** The category join a public product carries. */
export interface StorefrontProductCategory {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
}

/** The event join an `experience` product carries. */
export interface StorefrontProductEvent {
  id: string;
  date: string;
  capacity: number;
}

/**
 * `GET /catalog/products`, `GET /catalog/products/slug/:slug`.
 *
 * There is deliberately **no** cost, yield, BOM or margin field anywhere in
 * this type (`CAT-03`), so a public component cannot reference one.
 */
export interface StorefrontProduct {
  id: string;
  brand_id: string;
  category_id: string;
  type: ProductType;
  name: string;
  slug: string;
  description: string;
  story: string | null;
  /** Rupees, tax-inclusive (P5a decision 1). */
  base_price: number;
  /** GST percentage, e.g. `5`. Already contained in `base_price`. */
  tax_rate: number;
  hsn_code: string | null;
  fulfilment: FulfilmentType;
  stock_mode: StockMode;
  recipe_id: string | null;
  event_id: string | null;
  weight_grams: number | null;
  shelf_life_days: number | null;
  is_featured: boolean;
  /** `null` when the product has no published review — not `0`. */
  rating_avg: number | null;
  rating_count: number;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  media?: ProductMedia[];
  variants?: StorefrontVariant[];
  /** Trimmed to two fields by `PUBLIC_INCLUDE`; cost is never present. */
  recipe?: { id: string; preparation_type: PreparationType } | null;
  category?: StorefrontProductCategory | null;
  event?: StorefrontProductEvent | null;
}

export type StorefrontProductPage = CatalogEnvelope<StorefrontProduct>;

/** `GET /catalog/categories` — a bare array, not an envelope. */
export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
  sort_order: number;
  product_types: ProductType[];
  status: ProductStatus;
  _count?: { products: number };
}

// ─── search (SRCH-01) ───────────────────────────────────────────────────────

/**
 * One ranked hit from `GET /catalog/search`. The raw SQL projection is narrower
 * than a product row — there is no description, no media and no variants, so a
 * result card links to `/p/[slug]` rather than trying to render a full product.
 */
export interface CatalogSearchHit {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  base_price: number;
  rating_avg: number | null;
  rating_count: number;
  /** `ts_rank` — ordering only; never displayed. */
  rank: number;
}

export interface TypeFacet {
  type: ProductType;
  count: number;
}

export interface CategoryFacet {
  category_id: string;
  name: string;
  count: number;
}

export interface SearchFacets {
  types: TypeFacet[];
  categories: CategoryFacet[];
}

/**
 * `GET /catalog/search?q=` — the envelope plus facets.
 *
 * The facets are counted over the *same* text predicate but **without** the
 * `type`/`category_id` filters, so they describe what the visitor could still
 * narrow to rather than what they already narrowed to.
 */
export interface SearchEnvelope extends CatalogEnvelope<CatalogSearchHit> {
  facets: SearchFacets;
}

// ─── public reviews ─────────────────────────────────────────────────────────

/**
 * `GET /catalog/products/:id/reviews` — published rows only, with no customer
 * id and no moderation trail (`PUBLIC_SELECT` in `reviews.service.ts`).
 */
export interface ProductReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  media: string[];
  created_at: string;
  customer: { name: string | null };
}

export type ProductReviewPage = CatalogEnvelope<ProductReview>;

// ─── availability ───────────────────────────────────────────────────────────

/**
 * `GET /catalog/availability` (map, keyed by product id) and
 * `GET /catalog/availability/:productId` (one entry).
 *
 * The batch route only covers `prepared_food` and `packaged`; a product missing
 * from the map carries no stock constraint, which is not the same as being
 * unavailable.
 */
export interface StorefrontAvailability {
  available: boolean;
  servings_remaining: number;
  preparation_type: string;
}

export type StorefrontAvailabilityMap = Record<string, StorefrontAvailability>;

// ─── helpers ────────────────────────────────────────────────────────────────

/** First image of a public product, or `null`. */
export function storefrontProductImage(product: {
  media?: ProductMedia[] | null;
}): string | null {
  return product.media?.find((m) => m.kind === 'image')?.url ?? null;
}

/** The variant a product page should preselect: the default one, else the first. */
export function defaultVariant(
  product: Pick<StorefrontProduct, 'variants'>,
): StorefrontVariant | null {
  const variants = product.variants ?? [];
  return variants.find((v) => v.is_default) ?? variants[0] ?? null;
}

/**
 * The list price of a product/variant pair, in rupees.
 *
 * Display only. The charged price is re-derived server-side on every cart sync
 * and every quote (`CHK-01`), and a channel modifier can move it.
 */
export function variantPrice(
  product: Pick<StorefrontProduct, 'base_price'>,
  variant?: Pick<StorefrontVariant, 'price_delta'> | null,
): number {
  return Number((product.base_price + (variant?.price_delta ?? 0)).toFixed(2));
}

/** The composite key that identifies a cart line — a product *and* its variant. */
export function cartLineKey(productId: string, variantId?: string | null): string {
  return `${productId}:${variantId ?? ''}`;
}
