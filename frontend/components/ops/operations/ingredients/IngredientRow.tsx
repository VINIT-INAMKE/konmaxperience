'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { Ingredient, IngredientCategory } from '@/lib/types/ingredient';
import type { IngredientStock } from '@/lib/types/inventory';

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

interface IngredientRowProps {
  ingredient: Ingredient;
  stock?: IngredientStock | null;
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (ingredient: Ingredient) => void;
  isAdmin: boolean;
}

export function IngredientRow({ ingredient, stock, onEdit, onDelete, isAdmin }: IngredientRowProps) {
  const isLowStock = stock && stock.current_quantity < ingredient.min_stock_level;
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-sm font-medium">{ingredient.name}</td>
      <td className="px-4 py-3">
        <Badge className={`text-xs border-0 ${CATEGORY_COLORS[ingredient.category]}`}>
          {CATEGORY_LABELS[ingredient.category]}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {ingredient.base_unit}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {ingredient.min_stock_level} {ingredient.base_unit}
      </td>
      <td className="px-4 py-3">
        {stock ? (
          <div className="flex items-center gap-2">
            <span className={`font-mono text-xs ${isLowStock ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {stock.current_quantity} {ingredient.base_unit}
            </span>
            {isLowStock && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge className="text-xs border-0 bg-amber-500/15 text-amber-500">Low Stock</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Below minimum of {ingredient.min_stock_level} {ingredient.base_unit}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">&mdash;</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(ingredient)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Edit ingredient"
          >
            <Pencil className="size-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => onDelete(ingredient)}
              className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Delete ingredient"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
