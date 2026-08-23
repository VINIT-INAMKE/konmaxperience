'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { OrderItemStatus } from '@/lib/types/kds';
import { ORDER_ITEM_STATUS_LABELS } from '@/lib/types/kds';

const STATUS_CLASSES: Record<OrderItemStatus, string> = {
  pending: STATUS_BADGE.neutral,
  preparing: STATUS_BADGE.warning,
  ready: STATUS_BADGE.good,
  packed: STATUS_BADGE.good,
  shipped: STATUS_BADGE.neutral,
  delivered: STATUS_BADGE.neutral,
  attended: STATUS_BADGE.neutral,
  cancelled: STATUS_BADGE.serious,
};

interface KdsItemStatusBadgeProps {
  status: OrderItemStatus;
}

export function KdsItemStatusBadge({ status }: KdsItemStatusBadgeProps) {
  return (
    <Badge className={STATUS_CLASSES[status]}>
      {ORDER_ITEM_STATUS_LABELS[status]}
    </Badge>
  );
}
