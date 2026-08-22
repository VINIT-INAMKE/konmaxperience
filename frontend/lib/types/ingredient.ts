import type { RecipeStatus } from './recipe';

/** Prisma `UsageType`. */
export type UsageType = 'recipe_input' | 'supply' | 'equipment';

export const USAGE_TYPES: UsageType[] = ['recipe_input', 'supply', 'equipment'];

export const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  recipe_input: 'Recipe Ingredient',
  supply: 'Disposable Supply',
  equipment: 'Reusable Equipment',
};

/** A row of the DB-driven `IngredientCategory` table (GET /ingredient-categories). */
export interface IngredientCategoryItem {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
}

/** Trimmed category shape embedded in ingredient/stock payloads. */
export interface IngredientCategoryRef {
  id: string;
  name: string;
}

export interface IngredientRecipeLink {
  id: string;
  recipe: {
    id: string;
    name: string;
    status: RecipeStatus;
  };
}

export interface Ingredient {
  id: string;
  name: string;
  usage_type: UsageType;
  category_id: string | null;
  category_obj?: IngredientCategoryRef | null;
  base_unit: string;
  min_stock_level: number;
  created_at: string;
  updated_at: string;
  RecipeLines?: IngredientRecipeLink[];
}

export const BASE_UNITS = ['g', 'ml', 'pieces', 'kg', 'L'] as const;

/** Label for an ingredient's category, DB-driven with a neutral fallback. */
export function ingredientCategoryName(
  category: IngredientCategoryRef | null | undefined,
): string {
  return category?.name ?? 'Uncategorized';
}

/**
 * Categories are DB rows now, so badge colours are derived from the category id
 * instead of a hardcoded token map. Class strings stay literal so Tailwind's
 * scanner still emits them.
 */
const CATEGORY_BADGE_PALETTE = [
  'bg-blue-500/15 text-blue-400',
  'bg-green-500/15 text-green-400',
  'bg-orange-500/15 text-orange-400',
  'bg-yellow-500/15 text-yellow-600',
  'bg-red-500/15 text-red-400',
  'bg-purple-500/15 text-purple-400',
  'bg-cyan-500/15 text-cyan-400',
  'bg-pink-500/15 text-pink-400',
] as const;

export function ingredientCategoryBadgeClass(
  category: IngredientCategoryRef | null | undefined,
): string {
  if (!category) return 'bg-muted text-muted-foreground';
  let hash = 0;
  for (let i = 0; i < category.id.length; i += 1) {
    hash = (hash * 31 + category.id.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_BADGE_PALETTE[hash % CATEGORY_BADGE_PALETTE.length];
}
