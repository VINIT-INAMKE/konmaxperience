export type PrepBatchStatus = 'active' | 'depleted' | 'expired';
export type WasteType = 'ingredient' | 'prep_batch';
export type WasteReason = 'spoilage' | 'over_prep' | 'cooking_error' | 'expired' | 'other';

export interface PrepBatch {
  id: string;
  recipe_id: string;
  zone_id: string;
  quantity_produced: number;
  quantity_remaining: number;
  unit: string;
  prepared_by: string;
  expires_at: string | null;
  status: PrepBatchStatus;
  created_at: string;
  recipe?: { id: string; name: string; yield_unit: string; shelf_life_hours: number | null; computed_cost: number | null };
  zone?: { id: string; name: string };
  creator?: { id: string; name: string };
}

export interface WasteLog {
  id: string;
  waste_type: WasteType;
  ingredient_id: string | null;
  prep_batch_id: string | null;
  quantity: number;
  unit: string;
  reason: WasteReason;
  reason_notes: string | null;
  cost_impact: number;
  logged_by: string | null;
  zone_id: string;
  created_at: string;
  ingredient?: { id: string; name: string; base_unit: string };
  prep_batch?: { id: string; recipe?: { name: string }; unit: string };
  zone?: { id: string; name: string };
  creator?: { id: string; name: string } | null;
}

export interface DeductionPreviewLine {
  input_name: string;
  input_type: 'ingredient' | 'recipe';
  available: number;
  required: number;
  unit: string;
  sufficient: boolean;
}

export const PREP_BATCH_STATUSES: PrepBatchStatus[] = ['active', 'depleted', 'expired'];

export const PREP_BATCH_STATUS_LABELS: Record<PrepBatchStatus, string> = {
  active: 'Active',
  depleted: 'Depleted',
  expired: 'Expired',
};

export const PREP_BATCH_STATUS_BADGE_CLASSES: Record<PrepBatchStatus, string> = {
  active: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  depleted: 'text-muted-foreground bg-muted',
  expired: 'text-destructive bg-destructive/10',
};

export const WASTE_REASONS: WasteReason[] = ['spoilage', 'over_prep', 'cooking_error', 'expired', 'other'];

export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  spoilage: 'Spoilage',
  over_prep: 'Over-Prep',
  cooking_error: 'Cooking Error',
  expired: 'Expired',
  other: 'Other',
};

export const WASTE_REASON_BADGE_CLASSES: Record<WasteReason, string> = {
  spoilage: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  over_prep: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
  cooking_error: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950',
  expired: 'text-destructive bg-destructive/10',
  other: 'text-muted-foreground bg-muted',
};

export const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  ingredient: 'Ingredient',
  prep_batch: 'Prep Batch',
};

// --- Pick & Pack types ---

export interface PickAndPackOrder {
  id: string;
  order_number: number;
  customer_name: string | null;
  created_at: string;
  channel: string;
  items: PickAndPackItem[];
}

export interface PickAndPackItem {
  id: string;
  status: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  item_notes: string | null;
  preparation_type: string;
  components?: AssembleComponent[];
}

export interface AssembleComponent {
  recipe_id: string;
  recipe_name: string;
  quantity: number;
  unit: string;
}

// --- Supply Usage types ---

export interface SupplyUsageEntry {
  id: string;
  ingredient: { id: string; name: string; base_unit: string };
  zone: { id: string; name: string };
  creator: { id: string; name: string };
  original_quantity: number;
  unit: string;
  reason: string | null;
  created_at: string;
}
