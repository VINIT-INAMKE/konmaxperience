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
  'menu_categories',
  'menu_items',
] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export interface CellError {
  field: string;
  message: string;
}

export interface ImportRow {
  rowIndex: number; // 1-based row number from file
  raw: Record<string, string>; // original parsed values
  validated: Record<string, unknown>; // coerced typed values
  errors: CellError[]; // empty = valid
  status: 'valid' | 'invalid' | 'duplicate' | 'blocked';
  existingId?: string; // set when duplicate detected by name
}

export interface ParseResult {
  importType: ImportType;
  rows: ImportRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  blockedCount: number;
  columns: string[]; // column headers for frontend table
  warning?: string; // e.g. "This file was already imported on {date}"
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
  columns: string[]; // expected column headers
  requiredColumns: string[]; // columns that cannot be empty
}

/**
 * Strips commas from numeric strings before parsing (D-31).
 * Returns null if the cleaned string is empty or not a valid number.
 */
export function sanitizeNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export const IMPORT_TYPE_CONFIG: Record<ImportType, ImportTypeConfig> = {
  ingredients: {
    label: 'Ingredients',
    description:
      'Bulk import ingredient catalog with category, unit, and stock levels',
    columns: ['name', 'category', 'base_unit', 'min_stock_level'],
    requiredColumns: ['name', 'category', 'base_unit', 'min_stock_level'],
  },
  vendors: {
    label: 'Vendors',
    description:
      'Bulk import vendor roster with contact details and payment terms',
    columns: [
      'name',
      'phone',
      'email',
      'address',
      'payment_terms',
      'status',
    ],
    requiredColumns: ['name'],
  },
  vendor_pricing: {
    label: 'Vendor Pricing',
    description:
      'Bulk import price lists with ingredient and vendor name resolution',
    columns: ['vendor', 'ingredient', 'price', 'unit', 'effective_date'],
    requiredColumns: [
      'vendor',
      'ingredient',
      'price',
      'unit',
      'effective_date',
    ],
  },
  opening_stock: {
    label: 'Opening Stock',
    description:
      'Import initial stock quantities per ingredient and zone with unit conversion',
    columns: ['ingredient', 'zone', 'zone_id', 'quantity', 'unit', 'reason'],
    requiredColumns: ['ingredient', 'zone', 'quantity', 'unit'],
  },
  missions: {
    label: 'Missions',
    description:
      'Bulk import long-term missions with phase and scope classification',
    columns: [
      'title',
      'description',
      'phase',
      'scope',
      'start_date',
      'end_date',
    ],
    requiredColumns: ['title', 'description', 'phase', 'scope'],
  },
  quests: {
    label: 'Quests',
    description:
      'Bulk import weekly quests linked to missions with owner assignment',
    columns: [
      'title',
      'description',
      'mission',
      'week_number',
      'owner_email',
      'start_date',
      'end_date',
    ],
    requiredColumns: [
      'title',
      'description',
      'mission',
      'week_number',
      'owner_email',
    ],
  },
  tasks: {
    label: 'Tasks',
    description:
      'Bulk import tasks with mission/quest assignment, priority, and XP',
    columns: [
      'title',
      'description',
      'mission',
      'quest',
      'owner_email',
      'task_type',
      'domain',
      'priority',
      'xp',
      'due_date',
    ],
    requiredColumns: [
      'title',
      'description',
      'mission',
      'owner_email',
      'task_type',
      'domain',
      'priority',
    ],
  },
  kpis: {
    label: 'KPIs',
    description:
      'Bulk import key performance indicators with targets and domains',
    columns: [
      'name',
      'description',
      'unit',
      'target_value',
      'domain',
      'current_value',
      'status',
    ],
    requiredColumns: ['name', 'description', 'unit', 'target_value', 'domain'],
  },
  events: {
    label: 'Events',
    description:
      'Bulk import events with type, capacity, pricing, and zone/brand assignment',
    columns: [
      'title',
      'event_type',
      'date',
      'capacity',
      'price',
      'zone',
      'brand',
      'description',
    ],
    requiredColumns: ['title', 'event_type', 'date', 'capacity', 'price'],
  },
  recipes: {
    label: 'Recipes',
    description:
      'Multi-sheet XLSX import for recipe headers and BOM lines (XLSX only)',
    columns: [
      'name',
      'description',
      'prep_steps',
      'cooking_method',
      'yield_qty',
      'yield_unit',
      'portion_size',
      'shelf_life_hours',
      'brand',
      'zone',
    ],
    requiredColumns: [
      'name',
      'description',
      'prep_steps',
      'cooking_method',
      'yield_qty',
      'yield_unit',
      'portion_size',
    ],
  },
  menu_categories: {
    label: 'Menu Categories',
    description:
      'Bulk import menu categories with brand assignment and sort order',
    columns: ['name', 'brand', 'sort_order'],
    requiredColumns: ['name', 'brand'],
  },
  menu_items: {
    label: 'Menu Items',
    description:
      'Bulk import menu items with recipe, category, brand, and pricing',
    columns: [
      'name',
      'recipe',
      'category',
      'brand',
      'base_price',
      'available',
    ],
    requiredColumns: ['name', 'recipe', 'category', 'brand', 'base_price'],
  },
};
