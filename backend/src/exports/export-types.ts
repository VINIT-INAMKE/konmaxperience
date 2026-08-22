import { Permission } from '../types/permissions';

export interface ExportTypeConfig {
  label: string;
  permission: Permission;
  isTimeSeries: boolean;
  description: string;
}

export const REPORT_TYPES = [
  'orders',
  'revenue_summary',
  'top_items',
  'channel_breakdown',
  'recipe_costs',
  'inventory_levels',
  'stock_movements',
  'purchase_orders',
  'vendor_pricing',
  'waste_log',
  'prep_batches',
  'ingredients',
  'vendors',
  'recipes',
  'products',
  'feedback',
  'events',
  'event_guest_lists',
  'tasks',
  'kpis',
  'decision_log',
  'leaderboard',
  'missions',
  'quests',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const EXPORT_TYPE_CONFIG: Record<ReportType, ExportTypeConfig> = {
  orders: {
    label: 'Orders',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: true,
    description: 'filtered orders',
  },
  revenue_summary: {
    label: 'Revenue Summary',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: true,
    description: 'revenue summary by date',
  },
  top_items: {
    label: 'Top Items',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: true,
    description: 'top selling items',
  },
  channel_breakdown: {
    label: 'Channel Breakdown',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: true,
    description: 'channel revenue breakdown',
  },
  recipe_costs: {
    label: 'Recipe Costs',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: true,
    description: 'recipe cost analysis',
  },
  inventory_levels: {
    label: 'Inventory Levels',
    permission: Permission.MANAGE_INVENTORY,
    isTimeSeries: false,
    description: 'current stock levels',
  },
  stock_movements: {
    label: 'Stock Movements',
    permission: Permission.MANAGE_INVENTORY,
    isTimeSeries: true,
    description: 'stock movement history',
  },
  purchase_orders: {
    label: 'Purchase Orders',
    permission: Permission.MANAGE_PROCUREMENT,
    isTimeSeries: true,
    description: 'purchase orders with line items',
  },
  vendor_pricing: {
    label: 'Vendor Pricing',
    permission: Permission.MANAGE_PROCUREMENT,
    isTimeSeries: false,
    description: 'vendor price lists',
  },
  waste_log: {
    label: 'Waste Log',
    permission: Permission.MANAGE_KITCHEN,
    isTimeSeries: true,
    description: 'waste records',
  },
  prep_batches: {
    label: 'Prep Batches',
    permission: Permission.MANAGE_KITCHEN,
    isTimeSeries: true,
    description: 'prep batch history',
  },
  ingredients: {
    label: 'Ingredients',
    permission: Permission.MANAGE_OPS,
    isTimeSeries: false,
    description: 'ingredient master data',
  },
  vendors: {
    label: 'Vendors',
    permission: Permission.MANAGE_OPS,
    isTimeSeries: false,
    description: 'vendor directory',
  },
  recipes: {
    label: 'Recipes',
    permission: Permission.MANAGE_OPS,
    isTimeSeries: false,
    description: 'recipes with BOM lines',
  },
  products: {
    label: 'Products',
    permission: Permission.MANAGE_OPS,
    isTimeSeries: false,
    description: 'products with pricing and variants',
  },
  feedback: {
    label: 'Feedback',
    permission: Permission.MANAGE_OPS,
    isTimeSeries: true,
    description: 'customer feedback',
  },
  events: {
    label: 'Events',
    permission: Permission.MANAGE_OPS,
    isTimeSeries: false,
    description: 'events list',
  },
  event_guest_lists: {
    label: 'Event Guest Lists',
    permission: Permission.MANAGE_OPS,
    isTimeSeries: false,
    description: 'event bookings and guests',
  },
  tasks: {
    label: 'Tasks',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: false,
    description: 'task records',
  },
  kpis: {
    label: 'KPIs',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: false,
    description: 'KPI definitions and values',
  },
  decision_log: {
    label: 'Decision Log',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: false,
    description: 'team decisions',
  },
  leaderboard: {
    label: 'Leaderboard',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: false,
    description: 'XP rankings',
  },
  missions: {
    label: 'Missions',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: false,
    description: 'missions with progress',
  },
  quests: {
    label: 'Quests',
    permission: Permission.MANAGE_KPIS,
    isTimeSeries: false,
    description: 'quests with tasks and progress',
  },
};
