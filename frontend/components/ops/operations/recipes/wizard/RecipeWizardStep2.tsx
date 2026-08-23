'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { BomLineRow } from './BomLineRow';
import type { BomLineState } from './BomLineRow';
import { apiClient } from '@/lib/api-client';
import type { Ingredient } from '@/lib/types/ingredient';
import type { Recipe } from '@/lib/types/recipe';

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
  // Single query for all ingredients — shared across all BOM rows
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => apiClient.get<Ingredient[]>('/ingredients'),
    staleTime: 5 * 60 * 1000,
  });

  // Single query for all recipes (sub-recipe selection)
  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiClient.get<Recipe[]>('/recipes'),
    staleTime: 5 * 60 * 1000,
  });

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
              ingredients={ingredients}
              recipes={recipes}
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
        className="w-full min-h-[48px] rounded-lg border border-dashed border-line text-sm text-ink-muted hover:bg-muted/20 hover:text-foreground transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
      >
        + Add Line
      </button>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          className="h-9 text-sm px-4"
          onClick={onNext}
          type="button"
        >
          Next: Review &amp; Cost
        </Button>
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
