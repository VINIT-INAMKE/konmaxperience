'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { StockMovement, StockMovementType } from '@/lib/types/inventory';
import { MOVEMENT_TYPE_LABELS } from '@/lib/types/inventory';

/**
 * Movement kinds carry direction, not severity: stock coming in reads `good`,
 * stock leaving for a known reason reads `info`, waste reads `serious`. The two
 * kinds with no status meaning (`import`, `shipment_packed`) take the brand tints.
 */
const MOVEMENT_TYPE_CLASSES: Record<StockMovementType, string> = {
  purchase_received: STATUS_BADGE.good,
  prep_deducted: STATUS_BADGE.info,
  order_deducted: STATUS_BADGE.info,
  waste: STATUS_BADGE.serious,
  adjustment: STATUS_BADGE.neutral,
  supply_usage: STATUS_BADGE.info,
  import: 'text-brand bg-brand-soft border-transparent',
  shipment_packed: 'text-leaf bg-[var(--leaf)]/12 border-transparent',
  return: STATUS_BADGE.warning,
};

/**
 * The `reference_type` values the backend actually writes on a StockMovement.
 * `recipe_prep`, `customer_order` and `manual` were never emitted — the real
 * tokens are the ones below; anything else falls through to the raw string.
 */
const REFERENCE_TYPE_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  prep_batch: 'Prep Batch',
  order: 'Order',
  waste_log: 'Waste Log',
  supply_usage: 'Supply Usage',
  import: 'Import',
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
      <Badge className={`text-xs shrink-0 ${MOVEMENT_TYPE_CLASSES[movementType]}`}>
        {MOVEMENT_TYPE_LABELS[movementType]}
      </Badge>

      {/* Quantity */}
      <span
        className={`font-mono text-sm shrink-0 ${
          isPositive ? 'text-good' : 'text-serious'
        }`}
      >
        {isPositive ? '+' : ''}{qty} {baseUnit ?? movement.unit}
      </span>

      {/* Original quantity */}
      {movement.original_quantity != null && (
        <span className="font-mono text-xs text-ink-muted shrink-0">
          {Number(movement.original_quantity)} {movement.unit}
        </span>
      )}

      {/* Reason */}
      <span className="text-sm text-ink-muted truncate flex-1">
        {movement.reason ?? '\u2014'}
      </span>

      {/* Reference */}
      {movement.reference_type && (
        <span className="text-xs text-ink-muted shrink-0">
          {REFERENCE_TYPE_LABELS[movement.reference_type] ?? movement.reference_type}
        </span>
      )}

      {/* User */}
      <span className="text-xs text-ink-muted shrink-0">
        {movement.creator?.name ?? '\u2014'}
      </span>

      {/* Date */}
      <span className="text-xs text-ink-muted shrink-0">
        {dateStr}
      </span>
    </div>
  );
}
