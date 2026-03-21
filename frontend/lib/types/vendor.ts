export type VendorStatus = 'active' | 'inactive';

export interface VendorPrice {
  id: string;
  vendor_id: string;
  ingredient_id: string;
  ingredient?: { id: string; name: string; base_unit: string } | null;
  price: number;
  unit: string;
  effective_date: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  status: VendorStatus;
  created_at: string;
  VendorPrices?: VendorPrice[];
}

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

export const PAYMENT_TERMS_OPTIONS = ['COD', 'Net 7', 'Net 30'] as const;
