export type MenuCategoryStatus = 'active' | 'inactive';
export type MenuItemStatus = 'active' | 'inactive';
export type ModifierType = 'fixed' | 'percentage';

export interface MenuCategory {
  id: string;
  name: string;
  brand_id: string;
  sort_order: number;
  status: MenuCategoryStatus;
  MenuItems?: MenuItem[];
}

export interface MenuItem {
  id: string;
  recipe_id: string;
  category_id: string;
  name: string;
  base_price: number;
  image_url: string | null;
  available: boolean;
  status: MenuItemStatus;
  created_at: string;
  updated_at: string;
  recipe?: { id: string; name: string; computed_cost: number | null; yield_qty: number } | null;
  category?: { id: string; name: string; brand_id: string } | null;
}

export interface ChannelModifier {
  id: string;
  channel_type: string;
  modifier_type: ModifierType;
  modifier_value: number;
  status: string;
}

export function calcFoodCostPercent(computedCost: number | null, basePrice: number): number | null {
  if (!computedCost || !basePrice) return null;
  return (computedCost / basePrice) * 100;
}
