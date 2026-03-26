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
  category: IngredientCategory;
  base_unit: string;
  min_stock_level: number;
  created_at: string;
  updated_at: string;
  RecipeLines?: IngredientRecipeLink[];
}

export const INGREDIENT_CATEGORIES: IngredientCategory[] = ['dairy', 'vegetable', 'spice', 'grain', 'meat', 'oil'];

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  dairy: 'Dairy',
  vegetable: 'Vegetable',
  spice: 'Spice',
  grain: 'Grain',
  meat: 'Meat',
  oil: 'Oil',
};

export const BASE_UNITS = ['g', 'ml', 'pieces', 'kg', 'L'] as const;
