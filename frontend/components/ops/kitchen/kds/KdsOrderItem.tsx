'use client';

import type { KdsOrderItem as KdsOrderItemType, OrderItemStatus } from '@/lib/types/kds';
import { KdsItemStatusBadge } from './KdsItemStatusBadge';

interface KdsOrderItemProps {
  item: KdsOrderItemType;
  onStatusAdvance: (itemId: string, newStatus: OrderItemStatus) => void;
}

// The KDS only advances the kitchen leg of the item lifecycle; the fulfilment
// statuses (packed/shipped/delivered/attended) are terminal for this board.
const NEXT_STATUS: Record<OrderItemStatus, OrderItemStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: null,
  packed: null,
  shipped: null,
  delivered: null,
  attended: null,
  cancelled: null,
};

export function KdsOrderItem({ item, onStatusAdvance }: KdsOrderItemProps) {
  const nextStatus = NEXT_STATUS[item.status];
  const isReady = item.status === 'ready';

  const handleClick = () => {
    if (nextStatus) {
      onStatusAdvance(item.id, nextStatus);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isReady ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && nextStatus) {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`flex items-center justify-between gap-2 rounded-md px-3 min-h-[48px] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
        isReady
          ? 'opacity-50 cursor-default'
          : 'cursor-pointer hover:bg-[var(--ink)]/5 active:bg-[var(--ink)]/10'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-[18px] text-ink">{item.product_name}</span>
        <span className="text-sm text-ink-muted shrink-0">x{item.quantity}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.item_notes && (
          <span className="text-xs text-warning max-w-[120px] truncate">
            {item.item_notes}
          </span>
        )}
        <KdsItemStatusBadge status={item.status} />
      </div>
    </div>
  );
}
