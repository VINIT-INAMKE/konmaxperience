'use client';

import Link from 'next/link';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import type { IngredientStock } from '@/lib/types/inventory';
import type { IngredientCategory } from '@/lib/types/ingredient';

const CATEGORY_COLORS: Record<IngredientCategory, string> = {
  dairy: 'bg-blue-500/15 text-blue-400',
  vegetable: 'bg-green-500/15 text-green-400',
  spice: 'bg-orange-500/15 text-orange-400',
  grain: 'bg-yellow-500/15 text-yellow-600',
  meat: 'bg-red-500/15 text-red-400',
  oil: 'bg-purple-500/15 text-purple-400',
};

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  dairy: 'Dairy',
  vegetable: 'Vegetable',
  spice: 'Spice',
  grain: 'Grain',
  meat: 'Meat',
  oil: 'Oil',
};

interface InventoryRowProps {
  stock: IngredientStock;
}

export function InventoryRow({ stock }: InventoryRowProps) {
  const currentQty = Number(stock.current_quantity);
  const minLevel = Number(stock.ingredient?.min_stock_level ?? 0);
  const isLowStock = currentQty < minLevel;
  const category = stock.ingredient?.category as IngredientCategory | undefined;

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      {/* Name */}
      <td className="px-4 py-3 text-sm font-medium">
        {stock.ingredient?.name ?? '—'}
      </td>

      {/* Category */}
      <td className="px-4 py-3">
        {category && (
          <Badge className={`text-xs border-0 ${CATEGORY_COLORS[category]}`}>
            {CATEGORY_LABELS[category]}
          </Badge>
        )}
      </td>

      {/* Zone */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {stock.zone?.name ?? '—'}
      </td>

      {/* Current Stock */}
      <td className="px-4 py-3">
        <span
          className={`font-mono text-sm ${
            isLowStock ? 'text-amber-500' : 'text-green-400'
          }`}
        >
          {currentQty} {stock.ingredient?.base_unit}
        </span>
      </td>

      {/* Min Level */}
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {minLevel} {stock.ingredient?.base_unit}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        {isLowStock ? (
          <Badge className="text-xs border-0 bg-amber-500/15 text-amber-500">
            Low Stock
          </Badge>
        ) : (
          <Badge className="text-xs border-0 bg-muted text-muted-foreground">
            OK
          </Badge>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <Tooltip>
          <TooltipTrigger>
            <Link
              href={`/operations/inventory/${stock.ingredient_id}`}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex"
            >
              <History className="size-3.5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>View Movements</TooltipContent>
        </Tooltip>
      </td>
    </tr>
  );
}
