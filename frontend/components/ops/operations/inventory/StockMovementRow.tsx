'use client';

import { Badge } from '@/components/ui/badge';
import type { StockMovement } from '@/lib/types/inventory';
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_BADGE_CLASSES } from '@/lib/types/inventory';

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  recipe_prep: 'Recipe Prep',
  customer_order: 'Customer Order',
  manual: 'Manual',
};

interface StockMovementRowProps {
  movement: StockMovement;
  baseUnit?: string;
}

export function StockMovementRow({ movement, baseUnit }: StockMovementRowProps) {
  const qty = Number(movement.quantity);
  const isPositive = qty >= 0;
  const movementType = movement.movement_type;
  const dateStr = new Date(movement.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
      {/* Type Badge */}
      <Badge className={`text-xs border-0 shrink-0 ${MOVEMENT_TYPE_BADGE_CLASSES[movementType]}`}>
        {MOVEMENT_TYPE_LABELS[movementType]}
      </Badge>

      {/* Quantity */}
      <span
        className={`font-mono text-sm shrink-0 ${
          isPositive ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {isPositive ? '+' : ''}{qty} {baseUnit ?? movement.unit}
      </span>

      {/* Original quantity */}
      {movement.original_quantity != null && (
        <span className="font-mono text-xs text-muted-foreground shrink-0">
          {Number(movement.original_quantity)} {movement.unit}
        </span>
      )}

      {/* Reason */}
      <span className="text-sm text-muted-foreground truncate flex-1">
        {movement.reason ?? '\u2014'}
      </span>

      {/* Reference */}
      {movement.reference_type && (
        <span className="text-xs text-muted-foreground shrink-0">
          {REFERENCE_TYPE_LABELS[movement.reference_type] ?? movement.reference_type}
        </span>
      )}

      {/* User */}
      <span className="text-xs text-muted-foreground shrink-0">
        {movement.creator?.name ?? '\u2014'}
      </span>

      {/* Date */}
      <span className="text-xs text-muted-foreground shrink-0">
        {dateStr}
      </span>
    </div>
  );
}
