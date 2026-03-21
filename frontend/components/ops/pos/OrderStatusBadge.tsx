'use client';

import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS_LABELS } from '@/lib/types/kds';
import { PAYMENT_STATUS_LABELS } from '@/lib/types/orders';
import type { OrderStatus, PaymentStatus } from '@/lib/types/kds';

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  placed: 'bg-blue-500/15 text-blue-600 border-0',
  preparing: 'bg-amber-500/15 text-amber-600 border-0',
  ready: 'bg-emerald-500/15 text-emerald-700 border-0',
  served: 'bg-muted text-muted-foreground border-0',
  dispatched: 'bg-muted text-muted-foreground border-0',
  cancelled: 'bg-destructive/10 text-destructive border-0',
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-500/15 text-emerald-700 border-0',
  pending: 'bg-amber-500/15 text-amber-600 border-0',
  refunded: 'bg-blue-500/15 text-blue-600 border-0',
};

interface OrderStatusBadgeProps {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
}

export function OrderStatusBadge({ status, paymentStatus }: OrderStatusBadgeProps) {
  if (paymentStatus) {
    return (
      <Badge className={PAYMENT_STATUS_STYLES[paymentStatus]}>
        {PAYMENT_STATUS_LABELS[paymentStatus]}
      </Badge>
    );
  }

  if (status) {
    return (
      <Badge className={ORDER_STATUS_STYLES[status]}>
        {ORDER_STATUS_LABELS[status]}
      </Badge>
    );
  }

  return null;
}
