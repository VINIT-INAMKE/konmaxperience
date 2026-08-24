import { STATUS_BADGE } from '@/lib/status-styles';

/** Prisma `PurchaseOrderStatus`. */
export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  received: 'Received',
  cancelled: 'Cancelled',
};

/**
 * Task 19 re-tokenised this map. The Wave 1 sweeps partitioned `app/` and
 * `components/` and never covered `lib/types/**`, so these four raw palette
 * classes survived until the DESIGN-02 lint rule reached `lib/**`.
 *
 * `cancelled` is `muted` (struck through, no longer live) rather than a red —
 * a cancelled PO is not an error state.
 */
export const PO_STATUS_BADGE_CLASSES: Record<PurchaseOrderStatus, string> = {
  draft: STATUS_BADGE.neutral,
  ordered: STATUS_BADGE.info,
  received: STATUS_BADGE.good,
  cancelled: STATUS_BADGE.muted,
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
  /** The mission task that asked for this PO — SPEC §6.4's lineage chip. */
  linked_task_id?: string | null;
  linked_task?: {
    id: string;
    title: string;
    quest?: { id: string; title: string } | null;
  } | null;
}
