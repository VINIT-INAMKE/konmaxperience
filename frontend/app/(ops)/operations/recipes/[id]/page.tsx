'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NumberTicker } from '@/components/ui/number-ticker';
import { RecipeStatusBadge } from '@/components/ops/operations/recipes/RecipeStatusBadge';
import { RecipeDependencyTree } from '@/components/ops/operations/recipes/RecipeDependencyTree';
import { RecipeWizard } from '@/components/ops/operations/recipes/wizard/RecipeWizard';
import { apiClient } from '@/lib/api-client';
import type { Recipe } from '@/lib/types/recipe';

export default function RecipeDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();

  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: recipe, isLoading, isError } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => apiClient.get<Recipe>(`/recipes/${id}`),
    enabled: !!id,
  });

  const handleWizardSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['recipe', id] });
    void queryClient.invalidateQueries({ queryKey: ['recipes'] });
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground p-6">Loading recipe...</div>
    );
  }

  if (isError || !recipe) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm text-destructive">
          Could not load recipe. It may have been deleted or you may not have access.
        </div>
        <Link href="/operations/recipes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          Back to Recipes
        </Link>
      </div>
    );
  }

  const lines = recipe.RecipeLines ?? [];

  return (
    <div className="space-y-6 p-1">
      {/* Breadcrumb */}
      <Link
        href="/operations/recipes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Recipes
      </Link>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: recipe details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Name + status + edit */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{recipe.name}</h1>
                <RecipeStatusBadge status={recipe.status} />
              </div>
              {/* Brand + Zone */}
              <div className="flex items-center gap-2 flex-wrap">
                {recipe.brand && (
                  <Badge variant="outline" className="text-xs">{recipe.brand.name}</Badge>
                )}
                {recipe.zone && (
                  <Badge variant="outline" className="text-xs">{recipe.zone.name}</Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWizardOpen(true)}
            >
              Edit
            </Button>
          </div>

          {/* Description */}
          {recipe.description && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Description
              </h2>
              <p className="text-sm text-muted-foreground">{recipe.description}</p>
            </div>
          )}

          {/* Prep Steps */}
          {recipe.prep_steps && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Prep Steps
              </h2>
              <p className="text-sm whitespace-pre-line">{recipe.prep_steps}</p>
            </div>
          )}

          {/* Cooking Method */}
          {recipe.cooking_method && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Cooking Method
              </h2>
              <p className="text-sm">{recipe.cooking_method}</p>
            </div>
          )}

          {/* Yield + Portion + Shelf life */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Yield</p>
              <p className="text-sm font-medium">
                {recipe.yield_qty} {recipe.yield_unit}
              </p>
            </div>
            {recipe.portion_size && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Portion Size</p>
                <p className="text-sm font-medium">{recipe.portion_size}</p>
              </div>
            )}
            {recipe.shelf_life_hours != null && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Shelf Life</p>
                <p className="text-sm font-medium">{recipe.shelf_life_hours} hours</p>
              </div>
            )}
          </div>

          {/* Image */}
          {recipe.image_url && (
            <div>
              <img
                src={recipe.image_url}
                alt={recipe.name}
                className="rounded-lg max-w-full w-auto max-h-64 object-cover"
              />
            </div>
          )}
        </div>

        {/* Right column: BOM + Cost */}
        <div className="lg:col-span-1 space-y-4">
          {/* BOM / Dependency Tree card */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h2 className="text-sm font-semibold">Bill of Materials</h2>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ingredients added.</p>
            ) : (
              <RecipeDependencyTree lines={lines} />
            )}
          </div>

          {/* Cost Breakdown card */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h2 className="text-sm font-semibold">Cost Breakdown</h2>
            {recipe.computed_cost != null ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-muted-foreground">INR</span>
                  <NumberTicker
                    value={recipe.computed_cost}
                    decimalPlaces={2}
                    className="text-2xl font-bold"
                  />
                  <span className="text-xs text-muted-foreground ml-1">per batch</span>
                </div>
                {/* Line-by-line breakdown */}
                {lines.length > 0 && (
                  <div className="space-y-1 border-t border-border pt-2">
                    {lines.map((line) => {
                      const itemName =
                        line.input_type === 'ingredient'
                          ? (line.ingredient?.name ?? '—')
                          : (line.source_recipe?.name ?? '—');
                      return (
                        <div key={line.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{itemName}</span>
                          <span>
                            {line.quantity} {line.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="group relative">
                <p className="text-sm text-muted-foreground cursor-help" title="Add vendor prices to calculate cost">
                  Cost not available
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add vendor prices to get an accurate cost.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit wizard */}
      {recipe && (
        <RecipeWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          recipe={recipe}
          onSuccess={handleWizardSuccess}
        />
      )}
    </div>
  );
}
