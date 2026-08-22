export const IMPORT_TYPES = [
  'ingredients',
  'vendors',
  'vendor_pricing',
  'opening_stock',
  'missions',
  'quests',
  'tasks',
  'kpis',
  'events',
  'recipes',
  'product_categories',
  'products',
] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export interface CellError {
  field: string;
  message: string;
}

export interface ImportRow {
  rowIndex: number;
  raw: Record<string, string>;
  validated: Record<string, unknown>;
  errors: CellError[];
  status: 'valid' | 'invalid' | 'duplicate' | 'blocked';
  existingId?: string;
}

export interface ParseResult {
  importType: ImportType;
  rows: ImportRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  blockedCount: number;
  columns: string[];
  warning?: string;
}

export interface RecipeParseResult extends ParseResult {
  bomRows: ImportRow[];
  bomColumns: string[];
  bomValidCount: number;
  bomInvalidCount: number;
}

export interface CommitResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ rowIndex: number; message: string }>;
}

export interface ImportTypeConfig {
  label: string;
  description: string;
  columns: string[];
  icon: string; // lucide icon name
}

export interface PrerequisiteData {
  ingredients: number;
  vendors: number;
  zones: number;
  brands: number;
  missions: number;
  quests: number;
  approved_recipes: number;
  product_categories: number;
}

export const IMPORT_TYPE_CONFIG: Record<ImportType, ImportTypeConfig> = {
  ingredients: {
    label: 'Ingredients',
    description:
      'Bulk import ingredient catalog. The category column takes an existing ingredient category name (e.g. Vegetables, Dairy, Spices (dried)), not a code.',
    columns: ['name', 'category', 'base_unit', 'min_stock_level'],
    icon: 'Package',
  },
  vendors: {
    label: 'Vendors',
    description: 'Bulk import vendor roster with contact details and payment terms',
    columns: ['name', 'phone', 'email', 'address', 'payment_terms', 'status'],
    icon: 'Store',
  },
  vendor_pricing: {
    label: 'Vendor Pricing',
    description: 'Bulk import price lists with ingredient and vendor name resolution',
    columns: ['vendor', 'ingredient', 'price', 'unit', 'effective_date'],
    icon: 'DollarSign',
  },
  opening_stock: {
    label: 'Opening Stock',
    description: 'Opening inventory levels with ingredient and zone resolution',
    columns: ['ingredient', 'zone', 'zone_id', 'quantity', 'unit', 'reason'],
    icon: 'Warehouse',
  },
  missions: {
    label: 'Missions',
    description: 'Strategic missions with phase and scope classification',
    columns: ['title', 'description', 'phase', 'scope', 'start_date', 'end_date'],
    icon: 'Target',
  },
  quests: {
    label: 'Quests',
    description: 'Weekly quest milestones linked to missions',
    columns: ['title', 'description', 'mission', 'week_number', 'owner_email', 'start_date', 'end_date'],
    icon: 'Flag',
  },
  tasks: {
    label: 'Tasks',
    description: 'Individual tasks assigned to missions and quests',
    columns: ['title', 'description', 'mission', 'quest', 'owner_email', 'task_type', 'domain', 'priority', 'xp', 'due_date'],
    icon: 'CheckSquare',
  },
  kpis: {
    label: 'KPIs',
    description: 'Key performance indicators with targets and domains',
    columns: ['name', 'description', 'unit', 'target_value', 'domain', 'current_value', 'status'],
    icon: 'TrendingUp',
  },
  events: {
    label: 'Events',
    description: 'Villa events with type, capacity, and pricing',
    columns: ['title', 'event_type', 'date', 'capacity', 'price', 'zone', 'brand', 'description'],
    icon: 'Calendar',
  },
  recipes: {
    label: 'Recipes',
    description: 'Recipes with BOM lines (XLSX only, two-sheet format)',
    columns: ['name', 'description', 'prep_steps', 'cooking_method', 'yield_qty', 'yield_unit', 'portion_size', 'shelf_life_hours', 'brand', 'zone'],
    icon: 'ChefHat',
  },
  product_categories: {
    label: 'Product Categories',
    description: 'Product category structure linked to brands',
    columns: ['name', 'brand', 'sort_order'],
    icon: 'LayoutGrid',
  },
  products: {
    label: 'Products',
    description: 'Products linked to approved recipes and categories',
    columns: ['name', 'slug', 'type', 'recipe', 'category', 'brand', 'base_price', 'status'],
    icon: 'UtensilsCrossed',
  },
};
