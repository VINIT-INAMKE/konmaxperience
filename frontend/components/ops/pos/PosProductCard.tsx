'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { Product } from '@/lib/types/catalog';
import type { ProductAvailability } from '@/lib/types/orders';

interface PosProductCardProps {
  product: Product;
  availability: ProductAvailability | undefined;
  onAdd: () => void;
}

function getServingsBadge(availability: ProductAvailability | undefined) {
  if (!availability) return null;

  const { available, servings_remaining } = availability;

  if (!available || servings_remaining <= 0) {
    return (
      <span className="text-xs font-bold text-ink-muted">
        Sold Out
      </span>
    );
  }

  let colorClass: string = STATUS_BADGE.good;
  if (servings_remaining === 1) {
    colorClass = STATUS_BADGE.serious;
  } else if (servings_remaining <= 5) {
    colorClass = STATUS_BADGE.warning;
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold ${colorClass}`}
    >
      {servings_remaining} left
    </span>
  );
}

export function PosProductCard({
  product,
  availability,
  onAdd,
}: PosProductCardProps) {
  const isSoldOut =
    availability !== undefined &&
    (!availability.available || availability.servings_remaining <= 0);

  return (
    <div
      className={`min-w-[140px] min-h-[120px] rounded-lg ${
        isSoldOut ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      <Card className="h-full rounded-lg py-0">
        <div className="flex flex-col justify-between h-full p-3 gap-2">
          {/* Top: Name + badge */}
          <div className="flex items-start justify-between gap-1">
            <span className="text-sm font-normal leading-snug line-clamp-2">
              {product.name}
            </span>
            <div className="shrink-0">{getServingsBadge(availability)}</div>
          </div>

          {/* Price */}
          <span className="font-mono text-sm font-bold">
            ₹{product.base_price}
          </span>

          {/* Separator */}
          <div className="border-t border-line" />

          {/* Add button */}
          {!isSoldOut && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              + Add
            </Button>
          )}

          {isSoldOut && (
            <div className="h-9" />
          )}
        </div>
      </Card>
    </div>
  );
}
