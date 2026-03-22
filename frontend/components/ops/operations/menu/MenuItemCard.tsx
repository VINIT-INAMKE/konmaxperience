'use client';

import { useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { MagicCard } from '@/components/ui/magic-card';
import { FoodCostBadge } from './FoodCostBadge';
import { calcFoodCostPercent } from '@/lib/types/menu';
import type { MenuItem } from '@/lib/types/menu';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

interface MenuItemCardProps {
  item: MenuItem;
  isAdmin: boolean;
  onEdit: (item: MenuItem) => void;
  onRemove: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem, available: boolean) => Promise<void>;
}

export function MenuItemCard({
  item,
  isAdmin,
  onEdit,
  onRemove,
  onToggleAvailability,
}: MenuItemCardProps) {
  const [isToggling, setIsToggling] = useState(false);

  const foodCostPercent = calcFoodCostPercent(
    item.recipe?.computed_cost ?? null,
    item.base_price,
  );

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    try {
      await onToggleAvailability(item, checked);
    } finally {
      // Keep spinner for at least 500ms for UX clarity
      setTimeout(() => setIsToggling(false), 500);
    }
  };

  return (
    <MagicCard
      gradientColor={GRADIENT_OVERLAY}
      className="p-4 space-y-2 cursor-default"
    >
      {/* Row 1: item name */}
      <div>
        <span className="text-base font-semibold">{item.name}</span>
      </div>

      {/* Row 2: base price + food cost badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">
          INR {item.base_price.toLocaleString()}
        </span>
        <FoodCostBadge percent={foodCostPercent} />
      </div>

      {/* Row 3: availability toggle */}
      <div className="flex items-center gap-2">
        {isToggling ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none text-muted-foreground" />
        ) : (
          <Switch
            id={`available-${item.id}`}
            checked={item.available}
            onCheckedChange={(checked) => void handleToggle(checked)}
            disabled={isToggling}
          />
        )}
        <label
          htmlFor={`available-${item.id}`}
          className="text-sm text-muted-foreground cursor-pointer select-none"
        >
          Available
        </label>
      </div>

      {/* Row 4: edit + remove (admin or any authenticated for edit) */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-3"
          onClick={() => onEdit(item)}
        >
          <Pencil className="size-3 mr-1" />
          Edit
        </Button>
        {isAdmin && (
          <button
            className="ml-auto p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item.name} from menu`}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </MagicCard>
  );
}
