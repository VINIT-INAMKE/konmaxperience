import type { IngredientCategoryRef } from './ingredient';

/** Prisma `MovementType`. */
export type StockMovementType =
  | 'purchase_received'
  | 'prep_deducted'
  | 'order_deducted'
  | 'waste'
  | 'adjustment'
  | 'supply_usage'
  | 'import'
  | 'shipment_packed'
  | 'return';

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  purchase_received: 'Received',
  prep_deducted: 'Prep Deducted',
  order_deducted: 'Order Deducted',
  waste: 'Waste',
  adjustment: 'Adjustment',
  supply_usage: 'Supply Usage',
  import: 'Import',
  shipment_packed: 'Shipment Packed',
  return: 'Return',
};

export interface IngredientStock {
  id: string;
  ingredient_id: string;
  zone_id: string;
  current_quantity: number;
  updated_at: string;
  ingredient?: {
    id: string;
    name: string;
    category_id: string | null;
    category_obj?: IngredientCategoryRef | null;
    base_unit: string;
    min_stock_level: number;
  };
  zone?: { id: string; name: string };
}

/** Prisma `ActorType` — who wrote a movement row. */
export type StockMovementActorType = 'user' | 'customer' | 'system';

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
  created_by: string | null;
  actor_type: StockMovementActorType;
  actor_id: string | null;
  created_at: string;
  creator?: { id: string; name: string } | null;
}
