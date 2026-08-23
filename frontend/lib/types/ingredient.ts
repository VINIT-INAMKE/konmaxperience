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
 * Categories are DB rows, so a badge tint is derived from the category id rather
 * than a hand-maintained map. The ramp is **decorative, not semantic** — a
 * category carries no status meaning — so it is drawn from the brand/status token
 * layer in `app/tokens.css` and never from a raw Tailwind hue (SPEC §7). Class
 * strings stay literal so Tailwind's scanner still emits them, and every pair is
 * a tint + matching text token that resolves in both themes.
 */
const CATEGORY_BADGE_PALETTE = [
  'bg-brand-soft text-brand',
  'bg-[var(--leaf)]/15 text-leaf',
  'bg-[var(--gold)]/15 text-gold-text',
  'bg-[var(--status-info)]/12 text-[var(--status-info)]',
  'bg-[var(--status-good)]/12 text-[var(--status-good)]',
  'bg-[var(--status-warning)]/12 text-[var(--status-warning)]',
  'bg-[var(--status-serious)]/12 text-[var(--status-serious)]',
  'bg-surface-raised text-ink-subtle',
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
