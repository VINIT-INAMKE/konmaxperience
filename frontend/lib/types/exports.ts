export interface ExportRecord {
  id: string;
  report_type: string;
  format: 'csv' | 'xlsx';
  filters_applied: string | null;
  file_size_bytes: number;
  r2_key: string;
  download_url: string;
  generated_by: string;
  user: { name: string };
  status: 'completed' | 'generating' | 'failed';
  created_at: string;
}

export interface GenerateExportPayload {
  reportType: string;
  format: 'csv' | 'xlsx';
  dateFrom?: string;
  dateTo?: string;
  filters?: string;
}

export interface GenerateExportResponse {
  downloadUrl: string;
  exportId: string;
}

export type ReportType =
  | 'orders'
  | 'revenue_summary'
  | 'top_items'
  | 'channel_breakdown'
  | 'recipe_costs'
  | 'inventory_levels'
  | 'stock_movements'
  | 'purchase_orders'
  | 'vendor_pricing'
  | 'waste_log'
  | 'prep_batches'
  | 'ingredients'
  | 'vendors'
  | 'recipes'
  | 'menu_items'
  | 'feedback'
  | 'events'
  | 'event_guest_lists'
  | 'tasks'
  | 'kpis'
  | 'decision_log'
  | 'leaderboard'
  | 'missions'
  | 'quests';

export const EXPORT_TYPE_CONFIG: Record<
  ReportType,
  { label: string; isTimeSeries: boolean; description: string }
> = {
  orders: { label: 'Orders', isTimeSeries: true, description: 'filtered orders' },
  revenue_summary: { label: 'Revenue Summary', isTimeSeries: true, description: 'revenue summary by date' },
  top_items: { label: 'Top Items', isTimeSeries: true, description: 'top selling items' },
  channel_breakdown: { label: 'Channel Breakdown', isTimeSeries: true, description: 'channel revenue breakdown' },
  recipe_costs: { label: 'Recipe Costs', isTimeSeries: true, description: 'recipe cost analysis' },
  inventory_levels: { label: 'Inventory Levels', isTimeSeries: false, description: 'current stock levels' },
  stock_movements: { label: 'Stock Movements', isTimeSeries: true, description: 'stock movement history' },
  purchase_orders: { label: 'Purchase Orders', isTimeSeries: true, description: 'purchase orders with line items' },
  vendor_pricing: { label: 'Vendor Pricing', isTimeSeries: false, description: 'vendor price lists' },
  waste_log: { label: 'Waste Log', isTimeSeries: true, description: 'waste records' },
  prep_batches: { label: 'Prep Batches', isTimeSeries: true, description: 'prep batch history' },
  ingredients: { label: 'Ingredients', isTimeSeries: false, description: 'ingredient master data' },
  vendors: { label: 'Vendors', isTimeSeries: false, description: 'vendor directory' },
  recipes: { label: 'Recipes', isTimeSeries: false, description: 'recipes with BOM lines' },
  menu_items: { label: 'Menu Items', isTimeSeries: false, description: 'menu items with pricing' },
  feedback: { label: 'Feedback', isTimeSeries: true, description: 'customer feedback' },
  events: { label: 'Events', isTimeSeries: false, description: 'events list' },
  event_guest_lists: { label: 'Event Guest Lists', isTimeSeries: false, description: 'event bookings and guests' },
  tasks: { label: 'Tasks', isTimeSeries: false, description: 'task records' },
  kpis: { label: 'KPIs', isTimeSeries: false, description: 'KPI definitions and values' },
  decision_log: { label: 'Decision Log', isTimeSeries: false, description: 'team decisions' },
  leaderboard: { label: 'Leaderboard', isTimeSeries: false, description: 'XP rankings' },
  missions: { label: 'Missions', isTimeSeries: false, description: 'missions with progress' },
  quests: { label: 'Quests', isTimeSeries: false, description: 'quests with tasks and progress' },
};
