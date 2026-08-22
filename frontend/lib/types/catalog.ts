import type { PreparationType } from './recipe';

/** Prisma `ProductType`. */
export type ProductType = 'prepared_food' | 'packaged' | 'experience' | 'merchandise';
/** Prisma `FulfilmentType`. */
export type FulfilmentType = 'local' | 'shipped' | 'booking';
/** Prisma `StockMode`. */
export type StockMode = 'derived_from_recipe' | 'tracked' | 'capacity';
/** Prisma `ProductStatus`. */
export type ProductStatus = 'draft' | 'active' | 'archived';
/** Prisma `MediaKind`. */
export type MediaKind = 'image' | 'video';
/** ChannelModifier.modifier_type is still a free string on the backend. */
export type ModifierType = 'fixed' | 'percentage';
/** Prisma `OrderChannel`. */
export type OrderChannelValue = 'dine_in' | 'takeaway' | 'delivery' | 'marketplace';

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  prepared_food: 'Prepared food',
  packaged: 'Packaged',
  experience: 'Experience',
  merchandise: 'Merchandise',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

/** Fulfilment and stock behaviour are derived from the product type (SPEC 3.3). */
export const PRODUCT_TYPE_DEFAULTS: Record<
  ProductType,
  { fulfilment: FulfilmentType; stock_mode: StockMode; requires_recipe: boolean }
> = {
  prepared_food: { fulfilment: 'local', stock_mode: 'derived_from_recipe', requires_recipe: true },
  packaged: { fulfilment: 'shipped', stock_mode: 'derived_from_recipe', requires_recipe: true },
  experience: { fulfilment: 'booking', stock_mode: 'capacity', requires_recipe: false },
  merchandise: { fulfilment: 'shipped', stock_mode: 'tracked', requires_recipe: false },
};

export interface ProductMedia {
  id: string;
  url: string;
  alt: string;
  sort_order: number;
  kind: MediaKind;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price_delta: number;
  stock_on_hand: number;
  low_stock_threshold: number | null;
  is_default: boolean;
  status: ProductStatus;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
  sort_order: number;
  product_types: ProductType[];
  status: ProductStatus;
  _count?: { products: number };
}

export interface Product {
  id: string;
  brand_id: string;
  category_id: string;
  type: ProductType;
  name: string;
  slug: string;
  description: string;
  story: string | null;
  base_price: number;
  tax_rate: number;
  hsn_code: string | null;
  fulfilment: FulfilmentType;
  stock_mode: StockMode;
  recipe_id: string | null;
  event_id: string | null;
  weight_grams: number | null;
  shelf_life_days: number | null;
  is_featured: boolean;
  rating_avg: number | null;
  rating_count: number;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  media?: ProductMedia[];
  variants?: ProductVariant[];
  recipe?: {
    id: string;
    name?: string;
    computed_cost: number | null;
    yield_qty?: number;
    preparation_type: PreparationType;
  } | null;
  category?: { id: string; name: string; slug: string; brand_id: string } | null;
  event?: { id: string; date: string; capacity: number } | null;
}

export interface ChannelModifier {
  id: string;
  channel: OrderChannelValue;
  modifier_type: ModifierType;
  modifier_value: number;
  status: string;
}

/** First image for a product, or null — replaces the v1 `image_url` column. */
export function productImage(product: Product): string | null {
  return product.media?.find((m) => m.kind === 'image')?.url ?? null;
}

export function calcFoodCostPercent(computedCost: number | null, basePrice: number): number | null {
  if (!computedCost || !basePrice) return null;
  return (computedCost / basePrice) * 100;
}

/**
 * Lowercase kebab slug matching the backend's `^[a-z0-9]+(-[a-z0-9]+)*$` rule.
 * Products and product categories are now slug-addressable, so the forms derive
 * one from the name instead of asking for it twice.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
