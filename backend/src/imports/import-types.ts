export const IMPORT_TYPES = ['ingredients', 'vendors', 'vendor_pricing'] as const;
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
  status: 'valid' | 'invalid' | 'duplicate';
  existingId?: string; // set when duplicate detected by name
}

export interface ParseResult {
  importType: ImportType;
  rows: ImportRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  columns: string[]; // column headers for frontend table
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
};
