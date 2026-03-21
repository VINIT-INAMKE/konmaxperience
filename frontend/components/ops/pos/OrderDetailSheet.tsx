'use client';

import type { Order } from '@/lib/types/orders';

interface OrderDetailSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
}

// Stub - fully implemented in Task 2
export function OrderDetailSheet({ order, open, onOpenChange, onOrderUpdated }: OrderDetailSheetProps) {
  if (!open || !order) return null;
  return null;
}
