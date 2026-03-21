'use client';

import { useEffect, useState } from 'react';
import type { KdsOrder, OrderItemStatus } from '@/lib/types/kds';
import { BorderBeam } from '@/components/ui/border-beam';
import { KdsElapsedTimer } from './KdsElapsedTimer';
import { KdsOrderItem } from './KdsOrderItem';

interface KdsOrderCardProps {
  order: KdsOrder;
  isNew: boolean;
  isComplete: boolean;
  onStatusAdvance: (itemId: string, newStatus: OrderItemStatus) => void;
}

export function KdsOrderCard({ order, isNew, isComplete, onStatusAdvance }: KdsOrderCardProps) {
  const [showBeam, setShowBeam] = useState(isNew);
  const [fadedOut, setFadedOut] = useState(false);

  // BorderBeam for new orders: show for 3 seconds
  useEffect(() => {
    if (isNew) {
      setShowBeam(true);
      const timer = setTimeout(() => setShowBeam(false), 3000);
      return () => clearTimeout(timer);
    }
    setShowBeam(false);
  }, [isNew]);

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
      className={`relative rounded-lg bg-[oklch(0.205_0_0)] p-4 space-y-3 transition-opacity duration-1000 ${
        fadedOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {showBeam && <BorderBeam size={80} duration={3} />}

      {/* Header: order number + customer + timer */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[28px] font-bold leading-[1.1] text-white">
            #{order.id.slice(-4).toUpperCase()}
          </h3>
          {order.customer_name && (
            <p className="text-sm text-white/60">{order.customer_name}</p>
          )}
        </div>
        <KdsElapsedTimer createdAt={order.created_at} />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {order.items.map((item) => (
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
