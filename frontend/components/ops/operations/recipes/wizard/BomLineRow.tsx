'use client';

import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox';
import { apiClient } from '@/lib/api-client';
import { YIELD_UNITS } from '@/lib/types/recipe';
import type { Ingredient } from '@/lib/types/ingredient';
import type { Recipe } from '@/lib/types/recipe';

export interface BomLineState {
  id: string; // local UUID for keying
  input_type: 'ingredient' | 'recipe';
  item_id: string;
  item_name: string; // display name for review step
  quantity: string;
  unit: string;
  prep_notes: string;
}

interface CompatibleUnitsResponse {
  units: string[];
}

interface BomLineRowProps {
  line: BomLineState;
  index: number;
  onChange: (index: number, updated: BomLineState) => void;
  onRemove: (index: number) => void;
}

export function BomLineRow({ line, index, onChange, onRemove }: BomLineRowProps) {
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => apiClient.get<Ingredient[]>('/ingredients'),
    enabled: line.input_type === 'ingredient',
    staleTime: 5 * 60 * 1000, // 5 min — shared across all BOM rows, prevents parallel fetches
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiClient.get<Recipe[]>('/recipes'),
    enabled: line.input_type === 'recipe',
    staleTime: 5 * 60 * 1000,
  });

  const { data: compatibleUnits } = useQuery({
    queryKey: ['compatible-units', line.item_id],
    queryFn: () =>
      apiClient.get<CompatibleUnitsResponse>(`/ingredients/${line.item_id}/compatible-units`),
    enabled: line.input_type === 'ingredient' && !!line.item_id,
    staleTime: 5 * 60 * 1000, // unit conversions don't change often
  });

  const unitOptions =
    line.input_type === 'ingredient' && compatibleUnits?.units
      ? compatibleUnits.units
      : [...YIELD_UNITS];

  const comboboxItems =
    line.input_type === 'ingredient'
      ? ingredients.map((i) => ({ id: i.id, name: i.name }))
      : recipes.map((r) => ({ id: r.id, name: r.name }));

  const handleTypeChange = (newType: 'ingredient' | 'recipe') => {
    onChange(index, {
      ...line,
      input_type: newType,
      item_id: '',
      item_name: '',
      unit: '',
    });
  };

  const handleItemSelect = (itemId: string) => {
    const found = comboboxItems.find((i) => i.id === itemId);
    onChange(index, {
      ...line,
      item_id: itemId,
      item_name: found?.name ?? '',
      unit: '',
    });
  };

  return (
    <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-2 items-start py-2 border-b border-border last:border-0">
      {/* Type */}
      <Select
        value={line.input_type}
        onValueChange={(v) => handleTypeChange(v as 'ingredient' | 'recipe')}
      >
        <SelectTrigger className="w-full h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ingredient">Raw Ingredient</SelectItem>
          <SelectItem value="recipe">Sub-Recipe</SelectItem>
        </SelectContent>
      </Select>

      {/* Item combobox */}
      <Combobox
        items={comboboxItems.map((i) => i.id)}
        value={line.item_id || null}
        onValueChange={(v) => handleItemSelect(v ?? '')}
      >
        <ComboboxInput
          placeholder={
            line.input_type === 'ingredient' ? 'Search ingredients...' : 'Search recipes...'
          }
          className="h-9 text-xs"
          showClear={!!line.item_id}
        />
        <ComboboxContent>
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <ComboboxList>
            {(itemId) => {
              const found = comboboxItems.find((i) => i.id === itemId);
              return (
                <ComboboxItem key={itemId} value={itemId}>
                  {found?.name ?? itemId}
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {/* Quantity */}
      <Input
        type="number"
        min="0.001"
        step="any"
        placeholder="Qty"
        value={line.quantity}
        onChange={(e) => onChange(index, { ...line, quantity: e.target.value })}
        className="h-9 text-xs"
      />

      {/* Unit */}
      <Select
        value={line.unit}
        onValueChange={(v) => onChange(index, { ...line, unit: v ?? '' })}
        disabled={!line.item_id}
      >
        <SelectTrigger className="w-full h-9 text-xs">
          <SelectValue placeholder="Unit" />
        </SelectTrigger>
        <SelectContent>
          {unitOptions.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Prep Notes */}
      <Input
        placeholder="trimmed and diced"
        value={line.prep_notes}
        onChange={(e) => onChange(index, { ...line, prep_notes: e.target.value })}
        className="h-9 text-xs"
      />

      {/* Remove */}
      <button
        type="button"
        className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors mt-0.5"
        onClick={() => onRemove(index)}
        aria-label="Remove line"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
