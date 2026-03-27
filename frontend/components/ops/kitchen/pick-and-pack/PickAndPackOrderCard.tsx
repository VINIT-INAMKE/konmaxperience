'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PickAndPackOrder, PickAndPackItem } from '@/lib/types/kitchen';
import { BorderBeam } from '@/components/ui/border-beam';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { KdsElapsedTimer } from '@/components/ops/kitchen/kds/KdsElapsedTimer';
import { AssembleChecklist } from './AssembleChecklist';

interface PickAndPackOrderCardProps {
  order: PickAndPackOrder;
  isNew: boolean;
  onItemPicked: (itemId: string) => void;
}

const PREP_TYPE_BADGE_CLASSES: Record<string, string> = {
  batch_prepared: 'bg-[var(--info)]/10 text-[var(--info)]',
  ready_to_sell: 'bg-muted text-muted-foreground',
  assemble: 'bg-[var(--warning)]/10 text-[var(--warning)]',
};

const PREP_TYPE_LABELS: Record<string, string> = {
  batch_prepared: 'Batch Prepared',
  ready_to_sell: 'Ready to Sell',
  assemble: 'Assemble',
};

export function PickAndPackOrderCard({ order, isNew, onItemPicked }: PickAndPackOrderCardProps) {
  const [showBeam, setShowBeam] = useState(isNew);
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
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

  // Check if all items are picked
  const allPicked = useMemo(() => {
    if (order.items.length === 0) return false;
    return order.items.every((item) => pickedItems.has(item.id));
  }, [order.items, pickedItems]);

  // Fade out complete orders after 30s
  useEffect(() => {
    if (allPicked) {
      const timer = setTimeout(() => setFadedOut(true), 30000);
      return () => clearTimeout(timer);
    }
    setFadedOut(false);
  }, [allPicked]);

  const handlePick = (itemId: string) => {
    setPickedItems((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    onItemPicked(itemId);
  };

  if (fadedOut) return null;

  return (
    <Card
      className={`relative p-4 space-y-3 transition-opacity duration-1000 ${
        allPicked ? 'opacity-60' : 'opacity-100'
      }`}
    >
      {showBeam && <BorderBeam size={80} duration={3} />}

      {/* Header: order number + customer + timer + channel */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[28px] font-semibold leading-[1.1]">
            #{order.order_number}
          </h3>
          {order.customer_name && (
            <p className="text-sm text-muted-foreground">{order.customer_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {order.channel}
          </Badge>
          <KdsElapsedTimer createdAt={order.created_at} />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {order.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isPicked={pickedItems.has(item.id)}
            onPick={() => handlePick(item.id)}
          />
        ))}
      </div>

      {/* Order Ready banner */}
      {allPicked && (
        <div className="flex items-center justify-center gap-2 rounded-md py-2 bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
          <CheckCircle2 className="size-4" />
          <span className="text-sm font-medium">Order Ready</span>
        </div>
      )}
    </Card>
  );
}

// --- Item Row ---

function ItemRow({
  item,
  isPicked,
  onPick,
}: {
  item: PickAndPackItem;
  isPicked: boolean;
  onPick: () => void;
}) {
  const isAssemble = item.preparation_type === 'assemble';

  return (
    <div>
      <div
        role={isAssemble ? undefined : 'button'}
        tabIndex={isAssemble || isPicked ? -1 : 0}
        onClick={isAssemble || isPicked ? undefined : onPick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isAssemble && !isPicked) {
            e.preventDefault();
            onPick();
          }
        }}
        className={`flex items-center justify-between gap-2 rounded-md px-3 min-h-[48px] transition-colors ${
          isPicked
            ? 'line-through opacity-50'
            : isAssemble
              ? ''
              : 'cursor-pointer hover:bg-muted/50 active:bg-muted'
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isPicked && <CheckCircle2 className="size-4 text-[var(--success)] shrink-0" />}
          <span className="text-xl font-semibold">{item.menu_item_name}</span>
          <Badge variant="secondary" className="text-xs shrink-0">
            x{item.quantity}
          </Badge>
          <Badge
            className={`text-xs shrink-0 ${PREP_TYPE_BADGE_CLASSES[item.preparation_type] ?? 'bg-muted text-muted-foreground'}`}
          >
            {PREP_TYPE_LABELS[item.preparation_type] ?? item.preparation_type}
          </Badge>
        </div>
        {item.item_notes && (
          <span className="text-xs text-amber-400 max-w-[160px] truncate shrink-0">
            {item.item_notes}
          </span>
        )}
      </div>

      {/* Assemble checklist */}
      {isAssemble && item.components && item.components.length > 0 && (
        <AssembleChecklist
          components={item.components}
          onAllChecked={onPick}
        />
      )}
    </div>
  );
}
