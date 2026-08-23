'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import { ORDER_STATUS_LABELS } from '@/lib/types/kds';
import { PAYMENT_STATUS_LABELS } from '@/lib/types/orders';
import type { OrderStatus, PaymentStatus } from '@/lib/types/kds';

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  placed: STATUS_BADGE.info,
  confirmed: STATUS_BADGE.info,
  preparing: STATUS_BADGE.warning,
  ready: STATUS_BADGE.good,
  served: STATUS_BADGE.neutral,
  dispatched: STATUS_BADGE.neutral,
  shipped: STATUS_BADGE.neutral,
  delivered: STATUS_BADGE.neutral,
  completed: STATUS_BADGE.neutral,
  cancelled: STATUS_BADGE.serious,
  refunded: STATUS_BADGE.serious,
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: STATUS_BADGE.good,
  pending: STATUS_BADGE.warning,
  failed: STATUS_BADGE.critical,
  refunded: STATUS_BADGE.info,
  partially_refunded: STATUS_BADGE.info,
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
