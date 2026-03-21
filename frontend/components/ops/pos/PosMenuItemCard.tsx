'use client';

import { MagicCard } from '@/components/ui/magic-card';
import { Button } from '@/components/ui/button';
import type { MenuItem } from '@/lib/types/menu';
import type { MenuItemAvailability } from '@/lib/types/orders';

interface PosMenuItemCardProps {
  menuItem: MenuItem;
  availability: MenuItemAvailability | undefined;
  onAdd: () => void;
}

function getServingsBadge(availability: MenuItemAvailability | undefined) {
  if (!availability) return null;

  const { available, servings_remaining } = availability;

  if (!available || servings_remaining <= 0) {
    return (
      <span className="text-[12px] font-bold text-muted-foreground">
        Sold Out
      </span>
    );
  }

  let colorClass = 'bg-emerald-500/15 text-emerald-700';
  if (servings_remaining === 1) {
    colorClass = 'bg-red-500/15 text-red-700';
  } else if (servings_remaining <= 5) {
    colorClass = 'bg-amber-500/15 text-amber-700';
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[12px] font-bold ${colorClass}`}
    >
      {servings_remaining} left
    </span>
  );
}

export function PosMenuItemCard({
  menuItem,
  availability,
  onAdd,
}: PosMenuItemCardProps) {
  const isSoldOut =
    availability !== undefined &&
    (!availability.available || availability.servings_remaining <= 0);

  return (
    <div
      className={`min-w-[140px] min-h-[120px] rounded-lg ${
        isSoldOut ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      <MagicCard gradientColor="#1a1a2e" className="h-full rounded-lg">
        <div className="flex flex-col justify-between h-full p-3 gap-2">
          {/* Top: Name + badge */}
          <div className="flex items-start justify-between gap-1">
            <span className="text-[14px] font-normal leading-snug line-clamp-2">
              {menuItem.name}
            </span>
            <div className="shrink-0">{getServingsBadge(availability)}</div>
          </div>

          {/* Price */}
          <span className="font-mono text-[14px] font-bold">
            INR {menuItem.base_price}
          </span>

          {/* Separator */}
          <div className="border-t border-border" />

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
            <div className="flex items-center justify-center h-9">
              <span className="text-[12px] font-bold text-muted-foreground">
                Sold Out
              </span>
            </div>
          )}
        </div>
      </MagicCard>
    </div>
  );
}
