'use client';

import Link from 'next/link';
import { Leaf, ChefHat } from 'lucide-react';
import type { RecipeLine } from '@/lib/types/recipe';

interface RecipeDependencyTreeProps {
  lines: RecipeLine[];
  depth?: number;
}

export function RecipeDependencyTree({ lines, depth = 0 }: RecipeDependencyTreeProps) {
  if (lines.length === 0 && depth === 0) {
    return (
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>No sub-recipes</p>
        <p className="text-xs">This recipe uses only raw ingredients.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: depth * 16 }} className="space-y-1.5">
      {lines.map((line) => (
        <div key={line.id} className="flex items-start gap-1.5">
          {line.input_type === 'ingredient' ? (
            <>
              <Leaf className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm">{line.ingredient?.name ?? line.ingredient_id}</span>
                <span className="text-xs text-muted-foreground">
                  {line.quantity} {line.unit}
                </span>
                {line.prep_notes && (
                  <span className="text-xs text-muted-foreground italic">— {line.prep_notes}</span>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <ChefHat className="size-3.5 text-muted-foreground shrink-0" />
                <Link
                  href={`/operations/recipes/${line.source_recipe_id}`}
                  className="text-sm underline-offset-2 hover:underline cursor-pointer text-foreground"
                >
                  {line.source_recipe?.name ?? line.source_recipe_id}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {line.quantity} {line.unit}
                </span>
              </div>
              {/* Recursively render sub-recipe's lines */}
              {line.source_recipe?.RecipeLines && line.source_recipe.RecipeLines.length > 0 && (
                <RecipeDependencyTree
                  lines={line.source_recipe.RecipeLines}
                  depth={depth + 1}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
