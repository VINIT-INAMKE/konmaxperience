'use client';

import { Archive } from 'lucide-react';
import Link from 'next/link';
import { MagicCard } from '@/components/ui/magic-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Badge } from '@/components/ui/badge';
import { RecipeStatusBadge } from './RecipeStatusBadge';
import type { Recipe } from '@/lib/types/recipe';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

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
        <MagicCard
          gradientColor={GRADIENT_OVERLAY}
          className="p-4 space-y-2 cursor-pointer hover:bg-muted/20 transition-colors"
        >
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
            <span className="text-xs text-muted-foreground ml-auto">
              {recipe.yield_qty} {recipe.yield_unit}
            </span>
          </div>

          {/* Row 3: computed cost */}
          {recipe.computed_cost != null && (
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground text-xs">INR</span>
              <NumberTicker
                value={recipe.computed_cost}
                decimalPlaces={2}
                className="text-sm font-medium"
              />
            </div>
          )}

          {/* Row 4: archive action */}
          {isAdmin && (
            <div className="flex items-center justify-end pt-1">
              <button
                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
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
        </MagicCard>
      </Link>
    </div>
  );
}
