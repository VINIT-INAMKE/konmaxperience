'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { NumberTicker } from '@/components/ui/number-ticker';
import type { RecipeDetailsState } from './RecipeWizardStep1';
import type { BomLineState } from './BomLineRow';

interface RecipeWizardStep3Props {
  details: RecipeDetailsState;
  bomLines: BomLineState[];
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  computedCost: number | null;
}

export function RecipeWizardStep3({
  details,
  bomLines,
  onBack,
  onSubmit,
  isSubmitting,
  computedCost,
}: RecipeWizardStep3Props) {
  return (
    <div className="space-y-5">
      {/* Details summary */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Recipe Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Name</span>
            <p className="font-medium">{details.name}</p>
          </div>
          {details.description && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Description</span>
              <p>{details.description}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Yield</span>
            <p>
              {details.yield_qty} {details.yield_unit}
            </p>
          </div>
          {details.portion_size && (
            <div>
              <span className="text-muted-foreground">Portion Size</span>
              <p>{details.portion_size}</p>
            </div>
          )}
          {details.cooking_method && (
            <div>
              <span className="text-muted-foreground">Cooking Method</span>
              <p>{details.cooking_method}</p>
            </div>
          )}
          {details.shelf_life_hours && (
            <div>
              <span className="text-muted-foreground">Shelf Life</span>
              <p>{details.shelf_life_hours} hours</p>
            </div>
          )}
        </div>
      </div>

      {/* BOM summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          Bill of Materials{' '}
          {bomLines.length === 0 && (
            <span className="text-destructive text-xs font-normal ml-1">(empty — no ingredients added)</span>
          )}
        </h3>
        {bomLines.length > 0 ? (
          <div className="space-y-1">
            {bomLines.map((line, i) => (
              <div key={line.id} className="flex items-center gap-2 text-sm py-1 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground w-24 shrink-0">
                  {line.input_type === 'ingredient' ? 'Ingredient' : 'Sub-Recipe'}
                </span>
                <span className="flex-1 font-medium">{line.item_name || '(unnamed)'}</span>
                <span className="text-xs text-muted-foreground">
                  {line.quantity} {line.unit}
                </span>
                {line.prep_notes && (
                  <span className="text-xs text-muted-foreground italic">{line.prep_notes}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No ingredients added.</p>
        )}
      </div>

      {/* Cost card */}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <h3 className="text-sm font-semibold">Computed Cost</h3>
        {computedCost != null ? (
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground text-sm">INR</span>
            <NumberTicker
              value={computedCost}
              decimalPlaces={2}
              className="text-2xl font-bold"
            />
            <span className="text-xs text-muted-foreground ml-1">per batch</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Cost could not be calculated -- one or more ingredients have no vendor price. Add prices
            to get an accurate cost.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <ShimmerButton
          shimmerColor="#4ade80"
          className="h-9 text-sm px-4"
          onClick={onSubmit}
          disabled={isSubmitting}
          type="button"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Saving...
            </span>
          ) : (
            'Publish Recipe'
          )}
        </ShimmerButton>
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isSubmitting}
          className="h-9 text-sm"
        >
          Back
        </Button>
      </div>
    </div>
  );
}
