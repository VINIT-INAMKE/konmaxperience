'use client';

import type { KdsOrderItem as KdsOrderItemType, OrderItemStatus } from '@/lib/types/kds';
import { KdsItemStatusBadge } from './KdsItemStatusBadge';

interface KdsOrderItemProps {
  item: KdsOrderItemType;
  onStatusAdvance: (itemId: string, newStatus: OrderItemStatus) => void;
}

const NEXT_STATUS: Record<OrderItemStatus, OrderItemStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: null,
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
      className={`flex items-center justify-between gap-2 rounded-md px-3 min-h-[48px] transition-colors ${
        isReady
          ? 'opacity-50 cursor-default'
          : 'cursor-pointer hover:bg-white/5 active:bg-white/10'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-[18px] text-white/90">{item.menu_item_name}</span>
        <span className="text-sm text-white/50 shrink-0">x{item.quantity}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.item_notes && (
          <span className="text-xs text-amber-400 max-w-[120px] truncate">
            {item.item_notes}
          </span>
        )}
        <KdsItemStatusBadge status={item.status} />
      </div>
    </div>
  );
}
