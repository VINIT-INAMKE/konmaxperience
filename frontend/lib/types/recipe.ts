export type RecipeStatus = 'draft' | 'approved' | 'archived';

export interface RecipeLine {
  id: string;
  recipe_id: string;
  input_type: 'ingredient' | 'recipe';
  ingredient_id: string | null;
  source_recipe_id: string | null;
  ingredient?: { id: string; name: string; base_unit: string; category: string } | null;
  source_recipe?: Recipe | null;
  quantity: number;
  unit: string;
  prep_notes: string | null;
  sort_order: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  prep_steps: string;
  cooking_method: string;
  yield_qty: number;
  yield_unit: string;
  portion_size: string;
  shelf_life_hours: number | null;
  brand_id: string | null;
  zone_id: string | null;
  brand?: { id: string; name: string } | null;
  zone?: { id: string; name: string } | null;
  image_url: string | null;
  computed_cost: number | null;
  status: RecipeStatus;
  created_by: string;
  creator?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
  RecipeLines?: RecipeLine[];
}

export interface BomLineInput {
  input_type: 'ingredient' | 'recipe';
  item_id: string;
  quantity: number;
  unit: string;
  prep_notes?: string;
}

export const RECIPE_STATUS_LABELS: Record<RecipeStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  archived: 'Archived',
};

export const RECIPE_STATUSES: RecipeStatus[] = ['draft', 'approved', 'archived'];

export const YIELD_UNITS = ['g', 'ml', 'pieces', 'portions'] as const;
