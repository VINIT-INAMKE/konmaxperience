'use client';

import { Archive } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RecipeStatusBadge } from './RecipeStatusBadge';
import type { Recipe } from '@/lib/types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onArchive: (recipe: Recipe) => void;
  isAdmin: boolean;
}

export function RecipeCard({
  recipe,
  onArchive,
  isAdmin,
}: RecipeCardProps) {
  return (
    <div className="relative rounded-lg">
      <Link href={`/operations/recipes/${recipe.id}`} className="block">
        <Card className="p-4 gap-2 space-y-2 cursor-pointer transition-colors motion-reduce:transition-none hover:bg-muted/20">
          {/* Row 1: name + status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold">{recipe.name}</span>
            <RecipeStatusBadge status={recipe.status} />
          </div>

          {/* Row 2: brand + zone + yield */}
          <div className="flex items-center gap-2 flex-wrap">
            {recipe.brand && (
              <Badge variant="outline" className="text-xs">
                {recipe.brand.name}
              </Badge>
            )}
            {recipe.zone && (
              <Badge variant="outline" className="text-xs">
                {recipe.zone.name}
              </Badge>
            )}
            <span className="text-xs text-ink-muted ml-auto">
              {recipe.yield_qty} {recipe.yield_unit}
            </span>
          </div>

          {/* Row 3: computed cost */}
          {recipe.computed_cost != null && (
            <div className="flex items-center gap-1 text-sm">
              <span className="text-ink-muted text-xs">INR</span>
              <span className="text-sm font-medium tabular-nums">
                {recipe.computed_cost.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}

          {/* Row 4: archive action */}
          {isAdmin && (
            <div className="flex items-center justify-end pt-1">
              <button
                className="p-1 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onArchive(recipe);
                }}
                aria-label="Archive recipe"
              >
                <Archive className="size-3.5" />
              </button>
            </div>
          )}
        </Card>
      </Link>
    </div>
  );
}
