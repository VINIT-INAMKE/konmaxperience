'use client';

import { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { RecipeDependencyTree } from '@/components/ops/operations/recipes/RecipeDependencyTree';
import { YIELD_UNITS } from '@/lib/types/recipe';
import type { BomLineState, RecipeLine } from '@/lib/types/recipe';

interface BomTableRowProps {
  line: BomLineState;
  isGhost?: boolean;
  isLocked: boolean;
  lineCost: number | null;
  isSubRecipe: boolean;
  isExpanded: boolean;
  subRecipeLines: RecipeLine[];
  ingredientOptions: Array<{ id: string; name: string; base_unit: string }>;
  recipeOptions: Array<{ id: string; name: string }>;
  onToggleExpand: () => void;
  onChange: (id: string, field: keyof BomLineState, value: string) => void;
  onActivateGhost: () => void;
  onRemove: (id: string) => void;
}

export function BomTableRow({
  line,
  isGhost = false,
  isLocked,
  lineCost,
  isSubRecipe,
  isExpanded,
  subRecipeLines,
  ingredientOptions,
  recipeOptions,
  onToggleExpand,
  onChange,
  onActivateGhost,
  onRemove,
}: BomTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const comboboxItems = useMemo(() => {
    if (line.input_type === 'ingredient') {
      return ingredientOptions.map((i) => ({ id: i.id, name: i.name }));
    }
    return recipeOptions.map((r) => ({ id: r.id, name: r.name }));
  }, [line.input_type, ingredientOptions, recipeOptions]);

  const unitOptions = useMemo(() => {
    if (line.input_type !== 'ingredient' || !line.item_id) {
      return [...YIELD_UNITS];
    }
    const ingredient = ingredientOptions.find((i) => i.id === line.item_id);
    if (!ingredient) return [...YIELD_UNITS];
    const baseUnit = ingredient.base_unit;
    const KNOWN_CONVERSIONS: Record<string, string[]> = {
      g: ['g', 'kg'],
      kg: ['kg', 'g'],
      ml: ['ml', 'L'],
      L: ['L', 'ml'],
      pieces: ['pieces', 'dozen'],
      dozen: ['dozen', 'pieces'],
    };
    return KNOWN_CONVERSIONS[baseUnit] || [baseUnit];
  }, [line.input_type, line.item_id, ingredientOptions]);

  const handleTypeChange = (newType: string | null) => {
    const value = (newType ?? 'ingredient') as 'ingredient' | 'recipe';
    if (isGhost) {
      onActivateGhost();
      return;
    }
    onChange(line.id, 'input_type', value);
    onChange(line.id, 'item_id', '');
    onChange(line.id, 'item_name', '');
    onChange(line.id, 'unit', '');
  };

  const handleItemSelect = (itemId: string | null) => {
    const id = itemId ?? '';
    const found = comboboxItems.find((i) => i.id === id);
    onChange(line.id, 'item_id', id);
    onChange(line.id, 'item_name', found?.name ?? '');
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'grid grid-cols-[32px_110px_1fr_80px_90px_160px_80px_32px] gap-2 items-center min-h-[44px] px-1 py-1',
          isGhost && 'opacity-50'
        )}
      >
        {/* Drag handle (32px) */}
        <Tooltip>
          <TooltipTrigger
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            className={cn(
              'cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground',
              (isGhost || isLocked) && 'invisible'
            )}
            aria-label="Drag to reorder"
            tabIndex={-1}
          >
            <GripVertical className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Drag to reorder</TooltipContent>
        </Tooltip>

        {/* Type select (110px) */}
        <Select
          value={line.input_type}
          onValueChange={handleTypeChange}
          disabled={isLocked}
        >
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="Type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ingredient">Ingredient</SelectItem>
            <SelectItem value="recipe">Sub-Recipe</SelectItem>
          </SelectContent>
        </Select>

        {/* Item combobox (1fr) */}
        <div className="flex items-center gap-1">
          {isSubRecipe && !isGhost && (
            <button
              type="button"
              className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
              onClick={onToggleExpand}
              tabIndex={-1}
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          )}
          <Combobox
            items={comboboxItems.map((i) => i.id)}
            value={line.item_id || null}
            onValueChange={handleItemSelect}
            itemToStringLabel={(id) =>
              comboboxItems.find((i) => i.id === id)?.name ?? ''
            }
            disabled={isLocked}
          >
            <ComboboxInput
              placeholder={
                line.input_type === 'ingredient'
                  ? 'Search ingredients...'
                  : 'Search recipes...'
              }
              className="h-8 text-xs"
              showClear={!!line.item_id}
            />
            <ComboboxContent>
              <ComboboxEmpty>No items found.</ComboboxEmpty>
              <ComboboxList>
                {(itemId: string) => {
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
        </div>

        {/* Quantity (80px) */}
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Qty"
          value={line.quantity}
          onChange={(e) => onChange(line.id, 'quantity', e.target.value)}
          className="h-8 text-right tabular-nums text-sm"
          disabled={isLocked}
        />

        {/* Unit (90px) */}
        <Select
          value={line.unit}
          onValueChange={(v) => onChange(line.id, 'unit', v ?? '')}
          disabled={isLocked || !line.item_id}
        >
          <SelectTrigger className="w-full h-8 text-xs">
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

        {/* Prep notes (160px) */}
        <Input
          type="text"
          placeholder="Prep notes..."
          value={line.prep_notes}
          onChange={(e) => onChange(line.id, 'prep_notes', e.target.value)}
          className="h-8 text-xs"
          disabled={isLocked}
        />

        {/* Cost (80px) */}
        <div className="text-sm tabular-nums text-right pr-1">
          {lineCost !== null ? (
            <span>{'\u20B9'} {lineCost.toFixed(2)}</span>
          ) : (
            <span className="text-amber-500">&mdash;</span>
          )}
        </div>

        {/* Remove (32px) */}
        <button
          type="button"
          className={cn(
            'p-1 rounded text-muted-foreground hover:text-destructive transition-colors',
            (isGhost || isLocked) && 'invisible'
          )}
          onClick={() => onRemove(line.id)}
          aria-label="Remove line"
          tabIndex={-1}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Sub-recipe expansion */}
      {isExpanded && isSubRecipe && (
        <div className="col-span-full pl-8 bg-[var(--muted)]/30 rounded-md py-2">
          <RecipeDependencyTree lines={subRecipeLines} />
        </div>
      )}
    </>
  );
}
