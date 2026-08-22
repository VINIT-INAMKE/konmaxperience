'use client';

import { Minus, Plus } from 'lucide-react';
import { AnimatedListItem } from '@/components/ui/animated-list';
import { Button } from '@/components/ui/button';

interface CartItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

interface PosCartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (delta: number) => void;
}

export function PosCartItemRow({ item, onUpdateQuantity }: PosCartItemRowProps) {
  const lineTotal = item.unit_price * item.quantity;

  return (
    <AnimatedListItem>
      <div className="flex flex-col gap-1 py-2">
        <span className="text-sm font-normal leading-snug line-clamp-1">
          {item.name}
        </span>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => onUpdateQuantity(-1)}
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-8 text-center text-sm tabular-nums font-medium">
              {item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => onUpdateQuantity(1)}
            >
              <Plus className="size-3" />
            </Button>
          </div>
          <span className="font-mono text-sm font-bold tabular-nums">
            ₹{lineTotal}
          </span>
        </div>
      </div>
    </AnimatedListItem>
  );
}
