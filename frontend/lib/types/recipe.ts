export type RecipeStatus = 'draft' | 'pending' | 'approved' | 'archived';

export type PreparationType = 'scratch' | 'batch_prepared' | 'ready_to_sell' | 'assemble';

export const PREPARATION_TYPES: PreparationType[] = ['scratch', 'batch_prepared', 'ready_to_sell', 'assemble'];

export const PREPARATION_TYPE_LABELS: Record<PreparationType, string> = {
  scratch: 'Fresh Prep',
  batch_prepared: 'Batch Prepared',
  ready_to_sell: 'Ready to Sell',
  assemble: 'Assembly',
};

export const PREPARATION_TYPE_DESCRIPTIONS: Record<PreparationType, string> = {
  scratch: 'Made per order',
  batch_prepared: 'Pre-batched',
  ready_to_sell: 'Off the shelf',
  assemble: 'Combine parts',
};

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
  prep_steps: string | null;
  cooking_method: string | null;
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
  preparation_type: PreparationType;
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
  pending: 'Pending Approval',
  approved: 'Approved',
  archived: 'Archived',
};

export const RECIPE_STATUSES: RecipeStatus[] = ['draft', 'pending', 'approved', 'archived'];

export const YIELD_UNITS = ['g', 'ml', 'pieces', 'portions'] as const;

export interface BomLineState {
  id: string;
  input_type: 'ingredient' | 'recipe';
  item_id: string;
  item_name: string;
  quantity: string;
  unit: string;
  prep_notes: string;
  sort_order: number;
}

export interface CostData {
  vendorPrices: Array<{ ingredient_id: string; price: number; unit: string }>;
  unitConversions: Array<{ from_unit: string; to_unit: string; factor: number }>;
}

export interface CostPreviewResponse {
  cost: number | null;
  complete: boolean;
  missingPrices: string[];
}
