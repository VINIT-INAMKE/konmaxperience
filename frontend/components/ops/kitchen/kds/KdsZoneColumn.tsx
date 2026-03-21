'use client';

import type { KdsZoneData, OrderItemStatus } from '@/lib/types/kds';
import { KdsOrderCard } from './KdsOrderCard';

interface KdsZoneColumnProps {
  zone: KdsZoneData;
  newOrderIds: Set<string>;
  onStatusAdvance: (itemId: string, newStatus: OrderItemStatus) => void;
}

export function KdsZoneColumn({ zone, newOrderIds, onStatusAdvance }: KdsZoneColumnProps) {
  return (
    <div className="min-w-[280px] flex flex-col">
      {/* Zone header */}
      <div className="sticky top-0 z-10 bg-[oklch(0.145_0_0)] px-3 py-2 rounded-t-lg border-b border-white/10">
        <h2 className="text-[18px] font-bold leading-[1.2] text-white">
          {zone.zone_name}
        </h2>
      </div>

      {/* Scrollable order cards */}
      <div className="flex-1 overflow-y-auto space-y-3 p-2">
        {zone.orders.map((order) => {
          const isComplete = order.items.length > 0 && order.items.every((i) => i.status === 'ready');
          return (
            <KdsOrderCard
              key={order.id}
              order={order}
              isNew={newOrderIds.has(order.id)}
              isComplete={isComplete}
              onStatusAdvance={onStatusAdvance}
            />
          );
        })}
      </div>
    </div>
  );
}
