'use client';

import { AlertTriangle } from 'lucide-react';
import { AnimatedCost } from '@/components/ops/operations/recipes/builder/AnimatedCost';
import { CostEstimateBadge } from '@/components/ops/operations/recipes/builder/CostEstimateBadge';

interface RecipeCostPanelProps {
  batchCost: number | null;
  isEstimate: boolean;
  isComplete: boolean;
  missingPrices: string[];
  yieldQty: number;
  portionSize: string;
  productPrice: number | null;
}

export function RecipeCostPanel({
  batchCost,
  isEstimate,
  isComplete,
  missingPrices,
  yieldQty,
  portionSize,
  productPrice,
}: RecipeCostPanelProps) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-4 max-h-[calc(100vh-96px)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cost Preview</h2>
        {batchCost !== null && <CostEstimateBadge isEstimate={isEstimate} />}
      </div>

      {batchCost !== null ? (
        <div className="space-y-4">
          {/* Batch cost */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Batch Cost
            </p>
            <div className="flex items-baseline gap-1">
              <AnimatedCost value={batchCost} className="text-2xl font-semibold" />
              {!isComplete && (
                <span className="text-xs text-amber-500">(partial)</span>
              )}
            </div>
          </div>

          {/* Per-portion cost */}
          {yieldQty > 0 && portionSize && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Per Portion
              </p>
              <AnimatedCost
                value={batchCost / yieldQty}
                className="text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground">
                per {portionSize} ({yieldQty} portions/batch)
              </p>
            </div>
          )}

          {/* Food cost % */}
          {productPrice !== null && productPrice > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Food Cost %
              </p>
              <div className="flex items-baseline">
                <AnimatedCost
                  value={(batchCost / (yieldQty || 1) / productPrice) * 100}
                  prefix=""
                  className="text-lg font-semibold"
                />
                <span className="text-lg font-semibold">%</span>
              </div>
            </div>
          )}

          {/* Missing prices warning */}
          {missingPrices.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-500 text-xs font-medium">
                <AlertTriangle className="size-3.5" />
                {missingPrices.length} ingredient
                {missingPrices.length !== 1 ? 's' : ''} missing prices
              </div>
              <ul className="space-y-1">
                {missingPrices.map((name) => (
                  <li
                    key={name}
                    className="text-xs text-muted-foreground pl-5"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Cost unavailable</p>
          <p className="text-xs text-muted-foreground">
            Add vendor prices to ingredients to calculate batch cost.
          </p>
        </div>
      )}
    </div>
  );
}
