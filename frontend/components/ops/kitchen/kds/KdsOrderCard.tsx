'use client';

import { useEffect, useState } from 'react';
import type { KdsOrder, OrderItemStatus } from '@/lib/types/kds';
import { BorderBeam } from '@/components/ui/border-beam';
import { BEAM_FROM, BEAM_TO } from '@/lib/brand-colors';
import { KdsElapsedTimer } from './KdsElapsedTimer';
import { KdsOrderItem } from './KdsOrderItem';

interface KdsOrderCardProps {
  order: KdsOrder;
  isNew: boolean;
  isComplete: boolean;
  onStatusAdvance: (itemId: string, newStatus: OrderItemStatus) => void;
}

export function KdsOrderCard({ order, isNew, isComplete, onStatusAdvance }: KdsOrderCardProps) {
  const [fadedOut, setFadedOut] = useState(false);

  // Fade-out complete orders after 30 seconds
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setFadedOut(true), 30000);
      return () => clearTimeout(timer);
    }
    setFadedOut(false);
  }, [isComplete]);

  return (
    <div
      className={`relative rounded-lg bg-surface-raised p-4 space-y-3 transition-opacity duration-1000 motion-reduce:transition-none ${
        fadedOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {isNew && (
        <BorderBeam
          size={60}
          duration={5}
          colorFrom={BEAM_FROM}
          colorTo={BEAM_TO}
          className="motion-reduce:hidden"
        />
      )}

      {/* Header: order number + customer + timer */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[28px] font-bold leading-[1.1] text-ink-strong">
            #{order.order_number}
          </h3>
          {order.customer_name && (
            <p className="text-sm text-ink-subtle">{order.customer_name}</p>
          )}
        </div>
        <KdsElapsedTimer createdAt={order.created_at} />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {(order.items ?? []).map((item) => (
          <KdsOrderItem
            key={item.id}
            item={item}
            onStatusAdvance={onStatusAdvance}
          />
        ))}
      </div>
    </div>
  );
}
