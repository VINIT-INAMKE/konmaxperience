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
import {
  ingredientCategoryBadgeClass,
  ingredientCategoryName,
} from '@/lib/types/ingredient';

interface InventoryRowProps {
  stock: IngredientStock;
}

export function InventoryRow({ stock }: InventoryRowProps) {
  const currentQty = Number(stock.current_quantity);
  const minLevel = Number(stock.ingredient?.min_stock_level ?? 0);
  const isLowStock = currentQty < minLevel;
  const category = stock.ingredient?.category_obj ?? null;

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      {/* Name */}
      <td className="px-4 py-3 text-sm font-medium">
        {stock.ingredient?.name ?? '—'}
      </td>

      {/* Category */}
      <td className="px-4 py-3">
        <Badge className={`text-xs border-0 ${ingredientCategoryBadgeClass(category)}`}>
          {ingredientCategoryName(category)}
        </Badge>
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
