export type StockMovementType = 'received' | 'prep_deducted' | 'order_deducted' | 'waste' | 'adjustment';

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  received: 'Received',
  prep_deducted: 'Prep Deducted',
  order_deducted: 'Order Deducted',
  waste: 'Waste',
  adjustment: 'Adjustment',
};

export const MOVEMENT_TYPE_BADGE_CLASSES: Record<StockMovementType, string> = {
  received: 'bg-green-500/15 text-green-400',
  prep_deducted: 'bg-blue-500/15 text-blue-400',
  order_deducted: 'bg-indigo-500/15 text-indigo-400',
  waste: 'bg-red-500/15 text-red-400',
  adjustment: 'bg-muted text-muted-foreground',
};

export interface IngredientStock {
  id: string;
  ingredient_id: string;
  zone_id: string;
  current_quantity: number;
  updated_at: string;
  ingredient?: { id: string; name: string; category: string; base_unit: string; min_stock_level: number };
  zone?: { id: string; name: string };
}

export interface StockMovement {
  id: string;
  ingredient_id: string;
  zone_id: string;
  movement_type: StockMovementType;
  quantity: number;
  original_quantity: number;
  unit: string;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string;
  created_at: string;
  creator?: { id: string; name: string };
}
