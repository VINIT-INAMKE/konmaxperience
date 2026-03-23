export const IMPORT_TYPES = ['ingredients', 'vendors', 'vendor_pricing'] as const;
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
  status: 'valid' | 'invalid' | 'duplicate';
  existingId?: string;
}

export interface ParseResult {
  importType: ImportType;
  rows: ImportRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  columns: string[];
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

export const IMPORT_TYPE_CONFIG: Record<ImportType, ImportTypeConfig> = {
  ingredients: {
    label: 'Ingredients',
    description: 'Bulk import ingredient catalog with category, unit, and stock levels',
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
};
