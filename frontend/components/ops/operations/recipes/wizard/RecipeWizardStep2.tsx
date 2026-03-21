'use client';

import { Button } from '@/components/ui/button';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { BomLineRow } from './BomLineRow';
import type { BomLineState } from './BomLineRow';

interface RecipeWizardStep2Props {
  bomLines: BomLineState[];
  setBomLines: (lines: BomLineState[]) => void;
  onNext: () => void;
  onBack: () => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function RecipeWizardStep2({
  bomLines,
  setBomLines,
  onNext,
  onBack,
}: RecipeWizardStep2Props) {
  const handleAddLine = () => {
    setBomLines([
      ...bomLines,
      {
        id: generateId(),
        input_type: 'ingredient',
        item_id: '',
        item_name: '',
        quantity: '',
        unit: '',
        prep_notes: '',
      },
    ]);
  };

  const handleChange = (index: number, updated: BomLineState) => {
    const next = [...bomLines];
    next[index] = updated;
    setBomLines(next);
  };

  const handleRemove = (index: number) => {
    setBomLines(bomLines.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add the ingredients and sub-recipes this dish requires.
      </p>

      {/* BOM table */}
      {bomLines.length > 0 && (
        <div className="space-y-0">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-2 px-0 pb-1">
            {['Type', 'Item', 'Qty', 'Unit', 'Prep Notes', ''].map((h, i) => (
              <span key={i} className="text-xs font-medium text-muted-foreground">
                {h}
              </span>
            ))}
          </div>
          {bomLines.map((line, idx) => (
            <BomLineRow
              key={line.id}
              line={line}
              index={idx}
              onChange={handleChange}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Add line button */}
      <button
        type="button"
        onClick={handleAddLine}
        className="w-full min-h-[48px] rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/20 hover:text-foreground transition-colors"
      >
        + Add Line
      </button>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <ShimmerButton
          shimmerColor="#4ade80"
          className="h-9 text-sm px-4"
          onClick={onNext}
          type="button"
        >
          Next: Review &amp; Cost
        </ShimmerButton>
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="h-9 text-sm"
        >
          Back
        </Button>
      </div>
    </div>
  );
}
