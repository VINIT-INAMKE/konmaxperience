import type {
  EventType,
  FulfilmentType,
  MediaKind,
  PreparationType,
  ProductType,
  StockMode,
} from '@prisma/client';

/**
 * Demo catalog — twelve products across the four `ProductType`s, the eight
 * recipes and the twelve ingredients they need, plus the two events the
 * `experience` products book against.
 *
 * Everything here is *demo* data: it is written only by `seed-demo.ts`, which
 * refuses to run under `NODE_ENV=production` unless `SEED_DEMO_FORCE=true`.
 * Rows are linked by natural key (ingredient/recipe/event name, category and
 * product slug, variant SKU) so the seed is idempotent on re-run.
 */

/** `{R2_PUBLIC_URL}/{key}` is the storage service's public URL shape. */
const MEDIA_BASE = (
  process.env.R2_PUBLIC_URL || 'https://cdn.konma.store'
).replace(/\/+$/, '');

export function demoMediaUrl(slug: string): string {
  return `${MEDIA_BASE}/catalog/demo/${slug}.jpg`;
}

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export interface DemoIngredientSeed {
  name: string;
  /** Must match an `IngredientCategory.name` seeded by `seed-reference.ts`. */
  category: string;
  base_unit: string;
  min_stock_level: number;
}

export const DEMO_INGREDIENTS: DemoIngredientSeed[] = [
  { name: 'Basmati Rice', category: 'Grains & Cereals', base_unit: 'kg', min_stock_level: 10 },
  { name: 'Toor Dal', category: 'Legumes & Pulses', base_unit: 'kg', min_stock_level: 8 },
  { name: 'Chicken Thigh (boneless)', category: 'Proteins (meat)', base_unit: 'kg', min_stock_level: 6 },
  { name: 'Fresh Cream', category: 'Dairy', base_unit: 'L', min_stock_level: 4 },
  { name: 'Tomato', category: 'Vegetables', base_unit: 'kg', min_stock_level: 12 },
  { name: 'Mixed Salad Greens', category: 'Vegetables', base_unit: 'kg', min_stock_level: 3 },
  { name: 'Arabica Coffee Beans', category: 'Beverages', base_unit: 'kg', min_stock_level: 4 },
  { name: 'Whole Milk', category: 'Dairy', base_unit: 'L', min_stock_level: 20 },
  { name: 'Coriander Seeds', category: 'Spices (dried)', base_unit: 'kg', min_stock_level: 2 },
  { name: 'Green Cardamom Pods', category: 'Spices (dried)', base_unit: 'kg', min_stock_level: 1 },
  { name: 'Virgin Coconut Oil', category: 'Oils & Fats', base_unit: 'L', min_stock_level: 15 },
  { name: 'Whole Wheat Flour', category: 'Flours & Starches', base_unit: 'kg', min_stock_level: 10 },
];

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export interface DemoRecipeLineSeed {
  /** Ingredient name — resolved to `RecipeLine.ingredient_id` at seed time. */
  ingredient: string;
  quantity: number;
  unit: string;
}

export interface DemoRecipeSeed {
  name: string;
  description: string;
  preparation_type: PreparationType;
  yield_qty: number;
  yield_unit: string;
  portion_size: string;
  /** Non-null on every row so `STANDARDIZATION` readiness is meaningful (SPEC §4.3). */
  computed_cost: number;
  shelf_life_hours: number | null;
  lines: DemoRecipeLineSeed[];
}

/** Every demo recipe is seeded `status: approved` — SPEC §4.3 STANDARDIZATION. */
export const DEMO_RECIPES: DemoRecipeSeed[] = [
  {
    name: 'Signature Thali',
    description:
      'The house thali: steamed basmati, tempered toor dal and a tomato curry, plated to order.',
    preparation_type: 'scratch',
    yield_qty: 1,
    yield_unit: 'plate',
    portion_size: '1 plate (450 g)',
    computed_cost: 182.5,
    shelf_life_hours: 4,
    lines: [
      { ingredient: 'Basmati Rice', quantity: 0.15, unit: 'kg' },
      { ingredient: 'Toor Dal', quantity: 0.08, unit: 'kg' },
      { ingredient: 'Tomato', quantity: 0.12, unit: 'kg' },
      { ingredient: 'Coriander Seeds', quantity: 5, unit: 'g' },
    ],
  },
  {
    name: 'Butter Chicken Base',
    description:
      'Smoked tomato and cream gravy with charred thigh, batched every morning for the day service.',
    preparation_type: 'batch_prepared',
    yield_qty: 5,
    yield_unit: 'L',
    portion_size: '250 ml per bowl',
    computed_cost: 1240.0,
    shelf_life_hours: 48,
    lines: [
      { ingredient: 'Chicken Thigh (boneless)', quantity: 2, unit: 'kg' },
      { ingredient: 'Fresh Cream', quantity: 1, unit: 'L' },
      { ingredient: 'Tomato', quantity: 1.5, unit: 'kg' },
      { ingredient: 'Green Cardamom Pods', quantity: 10, unit: 'g' },
    ],
  },
  {
    name: 'Garden Salad',
    description:
      'Terrace greens and tomato, dressed with cold-pressed coconut oil. Assembled to order.',
    preparation_type: 'assemble',
    yield_qty: 1,
    yield_unit: 'bowl',
    portion_size: '1 bowl (220 g)',
    computed_cost: 96.0,
    shelf_life_hours: 2,
    lines: [
      { ingredient: 'Mixed Salad Greens', quantity: 0.15, unit: 'kg' },
      { ingredient: 'Tomato', quantity: 0.06, unit: 'kg' },
      { ingredient: 'Virgin Coconut Oil', quantity: 15, unit: 'ml' },
    ],
  },
  {
    name: 'Filter Coffee',
    description:
      'South Indian filter decoction pulled to order and cut with hot whole milk.',
    preparation_type: 'assemble',
    yield_qty: 1,
    yield_unit: 'cup',
    portion_size: '1 cup (180 ml)',
    computed_cost: 38.75,
    shelf_life_hours: 1,
    lines: [
      { ingredient: 'Arabica Coffee Beans', quantity: 18, unit: 'g' },
      { ingredient: 'Whole Milk', quantity: 0.12, unit: 'L' },
    ],
  },
  {
    name: 'Masala Chai Concentrate',
    description:
      'Cardamom-forward chai concentrate batched twice a day and finished per cup.',
    preparation_type: 'batch_prepared',
    yield_qty: 4,
    yield_unit: 'L',
    portion_size: '120 ml per cup',
    computed_cost: 610.0,
    shelf_life_hours: 12,
    lines: [
      { ingredient: 'Whole Milk', quantity: 3, unit: 'L' },
      { ingredient: 'Green Cardamom Pods', quantity: 20, unit: 'g' },
    ],
  },
  {
    name: 'Garam Masala Blend',
    description:
      'House garam masala: coriander and green cardamom, dry-roasted and milled in 1 kg lots.',
    preparation_type: 'ready_to_sell',
    yield_qty: 1,
    yield_unit: 'kg',
    portion_size: '100 g pack',
    computed_cost: 780.0,
    shelf_life_hours: 4320,
    lines: [
      { ingredient: 'Coriander Seeds', quantity: 0.55, unit: 'kg' },
      { ingredient: 'Green Cardamom Pods', quantity: 0.12, unit: 'kg' },
    ],
  },
  {
    name: 'Coconut Oil Bottling',
    description:
      'Cold-pressed virgin coconut oil, filtered and bottled in 500 ml and 1 L amber glass.',
    preparation_type: 'ready_to_sell',
    yield_qty: 12,
    yield_unit: 'L',
    portion_size: '500 ml bottle',
    computed_cost: 3960.0,
    shelf_life_hours: 8760,
    lines: [{ ingredient: 'Virgin Coconut Oil', quantity: 12, unit: 'L' }],
  },
  {
    name: 'Starter Kit Pack',
    description:
      'Sourdough starter kit: live culture, whole wheat feed flour, jar and a printed feeding card.',
    preparation_type: 'ready_to_sell',
    yield_qty: 10,
    yield_unit: 'kits',
    portion_size: '1 kit',
    computed_cost: 1450.0,
    shelf_life_hours: 720,
    lines: [{ ingredient: 'Whole Wheat Flour', quantity: 5, unit: 'kg' }],
  },
];

// ---------------------------------------------------------------------------
// Events (booked by the two `experience` products)
// ---------------------------------------------------------------------------

export interface DemoEventSeed {
  title: string;
  event_type: EventType;
  /** Days from the seed run — keeps demo events `upcoming` whenever the seed is run. */
  days_from_now: number;
  capacity: number;
  price: number;
  description: string;
}

export const DEMO_EVENTS: DemoEventSeed[] = [
  {
    title: "Chef's Table Dinner",
    event_type: 'dining',
    days_from_now: 30,
    capacity: 12,
    price: 4500,
    description:
      'Twelve seats, one counter, an eight-course tasting cooked in front of you.',
  },
  {
    title: 'Fermentation Workshop',
    event_type: 'workshop',
    days_from_now: 45,
    capacity: 16,
    price: 2500,
    description:
      'A hands-on afternoon on koji, kanji and sourdough. Take your starter home.',
  },
];

// ---------------------------------------------------------------------------
// Product categories
// ---------------------------------------------------------------------------

export interface DemoProductCategorySeed {
  name: string;
  slug: string;
  sort_order: number;
  product_types: ProductType[];
}

export const DEMO_PRODUCT_CATEGORIES: DemoProductCategorySeed[] = [
  { name: 'Signature Plates', slug: 'signature-plates', sort_order: 10, product_types: ['prepared_food'] },
  { name: 'Beverages', slug: 'beverages', sort_order: 20, product_types: ['prepared_food'] },
  { name: 'Pantry & Provisions', slug: 'pantry-provisions', sort_order: 30, product_types: ['packaged'] },
  { name: 'Experiences', slug: 'experiences', sort_order: 40, product_types: ['experience'] },
  { name: 'Villa Merchandise', slug: 'villa-merchandise', sort_order: 50, product_types: ['merchandise'] },
];

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface DemoProductVariantSeed {
  name: string;
  sku: string;
  price_delta: number;
  stock_on_hand: number;
  low_stock_threshold: number | null;
  is_default: boolean;
}

export interface DemoProductSeed {
  name: string;
  slug: string;
  type: ProductType;
  /** `DemoProductCategorySeed.slug`. */
  category_slug: string;
  fulfilment: FulfilmentType;
  stock_mode: StockMode;
  /** `DemoRecipeSeed.name` — set for `prepared_food` and `packaged` only. */
  recipe: string | null;
  /** `DemoEventSeed.title` — set for `experience` only. */
  event: string | null;
  description: string;
  story: string | null;
  base_price: number;
  /** 5 for prepared food and experiences, 12 for packaged and merchandise. */
  tax_rate: number;
  hsn_code: string | null;
  /** Required on every `shipped` product; null otherwise. */
  weight_grams: number | null;
  shelf_life_days: number | null;
  is_featured: boolean;
  media_kind: MediaKind;
  media_alt: string;
  variants: DemoProductVariantSeed[];
}

export const DEMO_PRODUCTS: DemoProductSeed[] = [
  {
    name: 'Konma Signature Thali',
    slug: 'konma-signature-thali',
    type: 'prepared_food',
    category_slug: 'signature-plates',
    fulfilment: 'local',
    stock_mode: 'derived_from_recipe',
    recipe: 'Signature Thali',
    event: null,
    description:
      'Rice, dal, a tomato curry and the day’s vegetable, plated the way the villa eats it.',
    story:
      'The plate the team eats at 1 pm every day, put on the menu unchanged.',
    base_price: 480,
    tax_rate: 5,
    hsn_code: '2106',
    weight_grams: null,
    shelf_life_days: null,
    is_featured: true,
    media_kind: 'image',
    media_alt: 'Konma signature thali plated on a terracotta plate',
    variants: [
      { name: 'Regular', sku: 'KX-THALI-REG', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
    ],
  },
  {
    name: 'Smoked Butter Chicken Bowl',
    slug: 'smoked-butter-chicken-bowl',
    type: 'prepared_food',
    category_slug: 'signature-plates',
    fulfilment: 'local',
    stock_mode: 'derived_from_recipe',
    recipe: 'Butter Chicken Base',
    event: null,
    description:
      'Charred thigh in a smoked tomato-and-cream gravy, over basmati.',
    story: null,
    base_price: 520,
    tax_rate: 5,
    hsn_code: '2106',
    weight_grams: null,
    shelf_life_days: null,
    is_featured: true,
    media_kind: 'image',
    media_alt: 'Smoked butter chicken bowl with rice',
    variants: [
      { name: 'Regular', sku: 'KX-BCB-REG', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
    ],
  },
  {
    name: 'Terrace Garden Salad',
    slug: 'terrace-garden-salad',
    type: 'prepared_food',
    category_slug: 'signature-plates',
    fulfilment: 'local',
    stock_mode: 'derived_from_recipe',
    recipe: 'Garden Salad',
    event: null,
    description:
      'Greens cut on the terrace that morning, tomato, coconut-oil dressing.',
    story: null,
    base_price: 320,
    tax_rate: 5,
    hsn_code: '2106',
    weight_grams: null,
    shelf_life_days: null,
    is_featured: false,
    media_kind: 'image',
    media_alt: 'Terrace garden salad in a shallow bowl',
    variants: [
      { name: 'Regular', sku: 'KX-SALAD-REG', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
    ],
  },
  {
    name: 'Villa Filter Coffee',
    slug: 'villa-filter-coffee',
    type: 'prepared_food',
    category_slug: 'beverages',
    fulfilment: 'local',
    stock_mode: 'derived_from_recipe',
    recipe: 'Filter Coffee',
    event: null,
    description: 'Decoction pulled to order, cut with hot whole milk.',
    story: null,
    base_price: 120,
    tax_rate: 5,
    hsn_code: '2101',
    weight_grams: null,
    shelf_life_days: null,
    is_featured: false,
    media_kind: 'image',
    media_alt: 'Filter coffee in a steel tumbler and dabara',
    variants: [
      { name: 'Small (180 ml)', sku: 'KX-COFFEE-S', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
      { name: 'Large (300 ml)', sku: 'KX-COFFEE-L', price_delta: 40, stock_on_hand: 0, low_stock_threshold: null, is_default: false },
    ],
  },
  {
    name: 'Masala Chai',
    slug: 'masala-chai',
    type: 'prepared_food',
    category_slug: 'beverages',
    fulfilment: 'local',
    stock_mode: 'derived_from_recipe',
    recipe: 'Masala Chai Concentrate',
    event: null,
    description: 'Cardamom-forward chai, finished per cup from the day’s batch.',
    story: null,
    base_price: 90,
    tax_rate: 5,
    hsn_code: '2101',
    weight_grams: null,
    shelf_life_days: null,
    is_featured: false,
    media_kind: 'image',
    media_alt: 'Masala chai in a glass tumbler',
    variants: [
      { name: 'Regular', sku: 'KX-CHAI-REG', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
    ],
  },
  {
    name: 'Konma Garam Masala',
    slug: 'konma-garam-masala',
    type: 'packaged',
    category_slug: 'pantry-provisions',
    fulfilment: 'shipped',
    stock_mode: 'derived_from_recipe',
    recipe: 'Garam Masala Blend',
    event: null,
    description:
      'Coriander and green cardamom, dry-roasted and milled in 1 kg lots. Ships nationwide.',
    story: 'Milled the morning it ships — nothing sits in the jar for a season.',
    base_price: 340,
    tax_rate: 12,
    hsn_code: '0910',
    weight_grams: 100,
    shelf_life_days: 180,
    is_featured: true,
    media_kind: 'image',
    media_alt: 'Konma garam masala in a kraft pouch',
    variants: [
      { name: '100 g', sku: 'KX-GM-100', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
      { name: '250 g', sku: 'KX-GM-250', price_delta: 420, stock_on_hand: 0, low_stock_threshold: null, is_default: false },
    ],
  },
  {
    name: 'Cold-Pressed Coconut Oil',
    slug: 'cold-pressed-coconut-oil',
    type: 'packaged',
    category_slug: 'pantry-provisions',
    fulfilment: 'shipped',
    stock_mode: 'derived_from_recipe',
    recipe: 'Coconut Oil Bottling',
    event: null,
    description:
      'Virgin coconut oil, cold-pressed and bottled in amber glass. Cooking grade.',
    story: null,
    base_price: 460,
    tax_rate: 12,
    hsn_code: '1513',
    weight_grams: 500,
    shelf_life_days: 365,
    is_featured: false,
    media_kind: 'image',
    media_alt: 'Amber glass bottle of cold-pressed coconut oil',
    variants: [
      { name: '500 ml', sku: 'KX-CCO-500', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
      { name: '1 L', sku: 'KX-CCO-1000', price_delta: 400, stock_on_hand: 0, low_stock_threshold: null, is_default: false },
    ],
  },
  {
    name: 'Sourdough Starter Kit',
    slug: 'sourdough-starter-kit',
    type: 'packaged',
    category_slug: 'pantry-provisions',
    fulfilment: 'shipped',
    stock_mode: 'derived_from_recipe',
    recipe: 'Starter Kit Pack',
    event: null,
    description:
      'A live culture, feed flour, a jar and a feeding card. Everything to bake by Sunday.',
    story: null,
    base_price: 890,
    tax_rate: 12,
    hsn_code: '2102',
    weight_grams: 750,
    shelf_life_days: 30,
    is_featured: false,
    media_kind: 'image',
    media_alt: 'Sourdough starter kit box with jar and flour',
    variants: [
      { name: 'Standard Kit', sku: 'KX-SDK-STD', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
    ],
  },
  {
    name: "Chef's Table Dinner",
    slug: 'chefs-table-dinner',
    type: 'experience',
    category_slug: 'experiences',
    fulfilment: 'booking',
    stock_mode: 'capacity',
    recipe: null,
    event: "Chef's Table Dinner",
    description:
      'Twelve seats at the counter, an eight-course tasting, cooked in front of you.',
    story: null,
    base_price: 4500,
    tax_rate: 5,
    hsn_code: '9963',
    weight_grams: null,
    shelf_life_days: null,
    is_featured: true,
    media_kind: 'image',
    media_alt: "Chef's table counter set for a tasting menu",
    variants: [
      { name: 'Single Seat', sku: 'KX-CTD-SEAT', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
    ],
  },
  {
    name: 'Fermentation Workshop',
    slug: 'fermentation-workshop',
    type: 'experience',
    category_slug: 'experiences',
    fulfilment: 'booking',
    stock_mode: 'capacity',
    recipe: null,
    event: 'Fermentation Workshop',
    description:
      'A hands-on afternoon on koji, kanji and sourdough. Take your starter home.',
    story: null,
    base_price: 2500,
    tax_rate: 5,
    hsn_code: '9963',
    weight_grams: null,
    shelf_life_days: null,
    is_featured: false,
    media_kind: 'image',
    media_alt: 'Fermentation workshop table with jars and crocks',
    variants: [
      { name: 'Single Seat', sku: 'KX-FW-SEAT', price_delta: 0, stock_on_hand: 0, low_stock_threshold: null, is_default: true },
    ],
  },
  {
    name: 'Konma Ceramic Mug',
    slug: 'konma-ceramic-mug',
    type: 'merchandise',
    category_slug: 'villa-merchandise',
    fulfilment: 'shipped',
    stock_mode: 'tracked',
    recipe: null,
    event: null,
    description:
      'Wheel-thrown 280 ml mug, glazed in the villa’s two house colours.',
    story: null,
    base_price: 750,
    tax_rate: 12,
    hsn_code: '6912',
    weight_grams: 420,
    shelf_life_days: null,
    is_featured: false,
    media_kind: 'image',
    media_alt: 'Two Konma ceramic mugs in terracotta and olive glaze',
    variants: [
      { name: 'Terracotta', sku: 'KX-MUG-TER', price_delta: 0, stock_on_hand: 40, low_stock_threshold: 8, is_default: true },
      { name: 'Olive', sku: 'KX-MUG-OLV', price_delta: 0, stock_on_hand: 25, low_stock_threshold: 8, is_default: false },
    ],
  },
  {
    name: 'Villa Linen Apron',
    slug: 'villa-linen-apron',
    type: 'merchandise',
    category_slug: 'villa-merchandise',
    fulfilment: 'shipped',
    stock_mode: 'tracked',
    recipe: null,
    event: null,
    description:
      'Cross-back linen apron, washed soft, with the villa’s mark at the hem.',
    story: null,
    base_price: 1290,
    tax_rate: 12,
    hsn_code: '6211',
    weight_grams: 320,
    shelf_life_days: null,
    is_featured: false,
    media_kind: 'image',
    media_alt: 'Cross-back linen apron hanging on a hook',
    variants: [
      { name: 'One Size', sku: 'KX-APRON-OS', price_delta: 0, stock_on_hand: 30, low_stock_threshold: 6, is_default: true },
    ],
  },
];

/** Mirrors the `search_text` trigger (Task 15) so demo search works before it exists. */
export function demoSearchText(
  product: DemoProductSeed,
  categoryName: string,
  brandName: string,
): string {
  return [
    product.name,
    product.description,
    product.story ?? '',
    categoryName,
    brandName,
  ]
    .filter(Boolean)
    .join(' ');
}
