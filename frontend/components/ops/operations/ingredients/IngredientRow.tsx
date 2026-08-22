'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { Ingredient } from '@/lib/types/ingredient';
import {
  ingredientCategoryBadgeClass,
  ingredientCategoryName,
} from '@/lib/types/ingredient';
import type { IngredientStock } from '@/lib/types/inventory';

interface IngredientRowProps {
  ingredient: Ingredient;
  stock?: IngredientStock | null;
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (ingredient: Ingredient) => void;
  isAdmin: boolean;
}

export function IngredientRow({ ingredient, stock, onEdit, onDelete, isAdmin }: IngredientRowProps) {
  const isLowStock = stock && stock.current_quantity < ingredient.min_stock_level;

  // Deduplicate recipes (an ingredient can appear in multiple lines of the same recipe)
  const uniqueRecipes = useMemo(() => {
    if (!ingredient.RecipeLines || ingredient.RecipeLines.length === 0) return [];
    const seen = new Set<string>();
    return ingredient.RecipeLines.reduce<{ id: string; name: string; status: string }[]>((acc, line) => {
      if (!seen.has(line.recipe.id)) {
        seen.add(line.recipe.id);
        acc.push(line.recipe);
      }
      return acc;
    }, []);
  }, [ingredient.RecipeLines]);

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-sm font-medium">
        <span className="flex items-center gap-1.5">
          {ingredient.name}
          {ingredient.usage_type === 'supply' && (
            <Badge variant="secondary" className="text-[10px] py-0">Supply</Badge>
          )}
          {ingredient.usage_type === 'equipment' && (
            <Badge variant="secondary" className="text-[10px] py-0">Equipment</Badge>
          )}
        </span>
      </td>
      <td className="px-4 py-3">
        <Badge
          className={`text-xs border-0 ${ingredientCategoryBadgeClass(ingredient.category_obj)}`}
        >
          {ingredientCategoryName(ingredient.category_obj)}
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
        {uniqueRecipes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {uniqueRecipes.slice(0, 3).map((recipe) => (
              <Link
                key={recipe.id}
                href={`/operations/recipes/${recipe.id}`}
                className="inline-block"
              >
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal cursor-pointer hover:bg-[var(--accent)] transition-colors"
                >
                  {recipe.name}
                </Badge>
              </Link>
            ))}
            {uniqueRecipes.length > 3 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                      +{uniqueRecipes.length - 3}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="text-xs space-y-0.5">
                      {uniqueRecipes.slice(3).map((r) => (
                        <div key={r.id}>{r.name}</div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No recipes</span>
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
