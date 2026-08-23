'use client';

import { useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FoodCostBadge } from './FoodCostBadge';
import { calcFoodCostPercent } from '@/lib/types/catalog';
import type { Product } from '@/lib/types/catalog';

interface ProductCardProps {
  item: Product;
  isAdmin: boolean;
  onEdit: (item: Product) => void;
  onRemove: (item: Product) => void;
  onToggleAvailability: (item: Product, available: boolean) => Promise<void>;
}

export function ProductCard({
  item,
  isAdmin,
  onEdit,
  onRemove,
  onToggleAvailability,
}: ProductCardProps) {
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
    <Card className="p-4 gap-2 space-y-2 cursor-default">
      {/* Row 1: item name */}
      <div>
        <span className="text-base font-semibold">{item.name}</span>
      </div>

      {/* Row 2: base price + food cost badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-ink-muted">
          ₹{item.base_price.toLocaleString()}
        </span>
        <FoodCostBadge percent={foodCostPercent} />
      </div>

      {/* Row 3: availability toggle */}
      <div className="flex items-center gap-2">
        {isToggling ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none text-ink-muted" />
        ) : (
          <Switch
            id={`available-${item.id}`}
            checked={item.status === 'active'}
            onCheckedChange={(checked) => void handleToggle(checked)}
            disabled={isToggling}
          />
        )}
        <label
          htmlFor={`available-${item.id}`}
          className="text-sm text-ink-muted cursor-pointer select-none"
        >
          Published
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
            className="ml-auto p-1 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item.name} from menu`}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </Card>
  );
}
