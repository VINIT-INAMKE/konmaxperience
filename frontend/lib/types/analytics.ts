import type { EvidenceSource } from './evidence';

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
  product_id: string;
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
  type: 'image' | 'document' | 'video' | 'link' | 'note' | 'system';
  url: string;
  notes: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  /**
   * SPEC §4.2 — `'bridge'` marks evidence the mission bridge captured rather than
   * a person. Optional because the feed endpoint may not select the column yet;
   * the card falls back to the manual presentation when it is absent.
   */
  source?: EvidenceSource;
  /** The bridge event that produced this evidence, when `source === 'bridge'`. */
  bridge_event?: string | null;
  /**
   * `quest` feeds the SPEC §6.4 lineage chip. `GET /evidence/feed` selects only
   * `title` today, so the chip renders nothing until that `include` grows —
   * which is why both extra members are optional rather than required.
   */
  task?: {
    id?: string;
    title: string;
    quest?: { id: string; title: string } | null;
  };
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

export interface ZoneUtilization {
  zone_name: string;
  active_orders: number;
}

export interface KitchenMetrics {
  orders_in_queue: number;
  items_completed_today: number;
  active_prep_batches: number;
  waste_today_cost: number;
  waste_percentage: number;
  average_prep_time_minutes: number | null;
  zone_utilization: ZoneUtilization[];
}
