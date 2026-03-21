export interface AnalyticsSummary {
  total_revenue: number;
  avg_food_cost_pct: number;
  total_orders: number;
  avg_order_value: number;
}

export interface RevenuePoint {
  date: string; // YYYY-MM-DD
  revenue: number;
}

export interface TopItem {
  menu_item_id: string;
  name: string;
  quantity_sold: number;
  revenue: number;
}

export interface ChannelRevenue {
  channel: string;
  revenue: number;
  order_count: number;
}

export interface RecipeCostRow {
  recipe_id: string;
  recipe_name: string;
  computed_cost: number;
  selling_price: number;
  food_cost_pct: number;
  units_sold: number;
}

export interface WinsEntry {
  id: string;
  type: 'quest_completed' | 'task_validated';
  title: string;
  actor_name: string;
  actor_role: string;
  timestamp: string; // ISO string
}

export interface EvidenceFeedEntry {
  id: string;
  task_id: string;
  uploaded_by: string;
  type: 'photo' | 'doc' | 'video' | 'link' | 'note';
  url: string;
  notes: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  task?: { title: string };
  uploader?: { id: string; name: string };
}

export interface ProcurementSummary {
  pending_po_count: number;
  low_stock_count: number;
  vendor_spend_this_month: number;
  total_inventory_value: number;
  top_vendors: Array<{ vendor_id: string; vendor_name: string; spend: number }>;
  po_status_breakdown: {
    draft: number;
    ordered: number;
    received: number;
  };
}

export interface KitchenMetrics {
  orders_in_queue: number;
  items_completed_today: number;
  active_prep_batches: number;
  waste_today_cost: number;
  waste_percentage: number;
  average_prep_time_minutes: number | null;
}
