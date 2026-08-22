/** Prisma `PurchaseOrderStatus`. */
export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  received: 'Received',
  cancelled: 'Cancelled',
};

export const PO_STATUS_BADGE_CLASSES: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  ordered: 'bg-blue-500/15 text-blue-400',
  received: 'bg-green-500/15 text-green-400',
  cancelled: 'bg-red-500/15 text-red-400',
};

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  received_quantity: number | null;
  ingredient?: { id: string; name: string; base_unit: string };
}

export interface PurchaseOrder {
  id: string;
  vendor_id: string;
  zone_id: string;
  status: PurchaseOrderStatus;
  total_amount: number;
  notes: string | null;
  ordered_by: string;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { id: string; name: string };
  zone?: { id: string; name: string };
  ordered_by_user?: { id: string; name: string };
  lines?: PurchaseOrderLine[];
}
