export type UsageType = 'recipe_input' | 'supply' | 'equipment';

export const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  recipe_input: 'Recipe Ingredient',
  supply: 'Disposable Supply',
  equipment: 'Reusable Equipment',
};

export interface IngredientCategoryItem {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
}

/** @deprecated Use IngredientCategoryItem from DB instead */
export type IngredientCategory = 'dairy' | 'vegetable' | 'spice' | 'grain' | 'meat' | 'oil';

export interface IngredientRecipeLink {
  id: string;
  recipe: {
    id: string;
    name: string;
    status: string;
  };
}

export interface Ingredient {
  id: string;
  name: string;
  /** @deprecated Use category_id + category_obj instead */
  category: string | null;
  usage_type: UsageType;
  category_id: string | null;
  category_obj?: IngredientCategoryItem | null;
  base_unit: string;
  min_stock_level: number;
  created_at: string;
  updated_at: string;
  RecipeLines?: IngredientRecipeLink[];
}

/** @deprecated Use DB-driven IngredientCategoryItem[] from GET /ingredient-categories */
export const INGREDIENT_CATEGORIES: IngredientCategory[] = ['dairy', 'vegetable', 'spice', 'grain', 'meat', 'oil'];

/** @deprecated Use DB-driven IngredientCategoryItem[] from GET /ingredient-categories */
export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  dairy: 'Dairy',
  vegetable: 'Vegetable',
  spice: 'Spice',
  grain: 'Grain',
  meat: 'Meat',
  oil: 'Oil',
};

export const BASE_UNITS = ['g', 'ml', 'pieces', 'kg', 'L'] as const;
