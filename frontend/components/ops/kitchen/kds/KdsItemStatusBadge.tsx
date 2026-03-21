'use client';

import { Badge } from '@/components/ui/badge';
import type { OrderItemStatus } from '@/lib/types/kds';
import { ORDER_ITEM_STATUS_LABELS } from '@/lib/types/kds';

const STATUS_CLASSES: Record<OrderItemStatus, string> = {
  pending: 'text-muted-foreground bg-muted',
  preparing: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  ready: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
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
