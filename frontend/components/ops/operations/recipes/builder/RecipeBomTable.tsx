'use client';

import { useState, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BomTableRow } from '@/components/ops/operations/recipes/builder/BomTableRow';
import type { BomLineState, RecipeLine } from '@/lib/types/recipe';

export interface RecipeBomTableProps {
  lines: BomLineState[];
  isLocked: boolean;
  vendorPriceMap: Map<string, { price: number; unit: string }>;
  subRecipeCostMap: Map<
    string,
    { computed_cost: number | null; yield_qty: number; yield_unit: string }
  >;
  conversionMap: Map<string, number>;
  subRecipeLineMap: Map<string, RecipeLine[]>;
  ingredientOptions: Array<{ id: string; name: string; base_unit: string }>;
  recipeOptions: Array<{ id: string; name: string }>;
  onChange: (newLines: BomLineState[]) => void;
}

export function calcLineCost(
  line: BomLineState,
  vendorPriceMap: Map<string, { price: number; unit: string }>,
  subRecipeCostMap: Map<
    string,
    { computed_cost: number | null; yield_qty: number; yield_unit: string }
  >,
  conversionMap: Map<string, number>
): number | null {
  if (!line.item_id || !line.quantity) return null;
  const qty = parseFloat(line.quantity);
  if (isNaN(qty) || qty <= 0) return null;

  if (line.input_type === 'ingredient') {
    const priceInfo = vendorPriceMap.get(line.item_id);
    if (!priceInfo) return null;
    if (line.unit === priceInfo.unit) return qty * priceInfo.price;
    const direct = conversionMap.get(`${line.unit}:${priceInfo.unit}`);
    if (direct !== undefined) return qty * direct * priceInfo.price;
    const reverse = conversionMap.get(`${priceInfo.unit}:${line.unit}`);
    if (reverse !== undefined && reverse !== 0)
      return (qty / reverse) * priceInfo.price;
    return null;
  }

  if (line.input_type === 'recipe') {
    const sub = subRecipeCostMap.get(line.item_id);
    if (!sub?.computed_cost || !sub.yield_qty) return null;
    return (sub.computed_cost / sub.yield_qty) * qty;
  }

  return null;
}

export function RecipeBomTable({
  lines,
  isLocked,
  vendorPriceMap,
  subRecipeCostMap,
  conversionMap,
  subRecipeLineMap,
  ingredientOptions,
  recipeOptions,
  onChange,
}: RecipeBomTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const ghostIdRef = useRef(crypto.randomUUID());

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const ids = lines.map((l) => l.id);
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        const reordered = arrayMove(lines, oldIndex, newIndex).map(
          (l, i) => ({ ...l, sort_order: i })
        );
        onChange(reordered);
      }
    },
    [lines, onChange]
  );

  const handleLineChange = useCallback(
    (id: string, field: keyof BomLineState, value: string) => {
      onChange(
        lines.map((l) =>
          l.id === id ? { ...l, [field]: value } : l
        )
      );
    },
    [lines, onChange]
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(lines.filter((l) => l.id !== id));
    },
    [lines, onChange]
  );

  const addNewLine = useCallback(() => {
    const newLine: BomLineState = {
      id: crypto.randomUUID(),
      input_type: 'ingredient',
      item_id: '',
      item_name: '',
      quantity: '',
      unit: '',
      prep_notes: '',
      sort_order: lines.length,
    };
    onChange([...lines, newLine]);
  }, [lines, onChange]);

  const handleActivateGhost = useCallback(() => {
    const newLine: BomLineState = {
      id: ghostIdRef.current,
      input_type: 'ingredient',
      item_id: '',
      item_name: '',
      quantity: '',
      unit: '',
      prep_notes: '',
      sort_order: lines.length,
    };
    onChange([...lines, newLine]);
    ghostIdRef.current = crypto.randomUUID();
  }, [lines, onChange]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const ghostLine: BomLineState = {
    id: ghostIdRef.current,
    input_type: 'ingredient',
    item_id: '',
    item_name: '',
    quantity: '',
    unit: '',
    prep_notes: '',
    sort_order: lines.length,
  };

  const ids = lines.map((l) => l.id);

  return (
    <div>
      {/* Table header */}
      <div className="grid grid-cols-[32px_110px_1fr_80px_90px_160px_80px_32px] gap-2 px-1 py-1 border-b border-border mb-1">
        <span />
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Type
        </span>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Item
        </span>
        <span className="text-xs text-muted-foreground uppercase tracking-wide text-right">
          Qty
        </span>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Unit
        </span>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Prep Notes
        </span>
        <span className="text-xs text-muted-foreground uppercase tracking-wide text-right">
          Cost
        </span>
        <span />
      </div>

      {/* Empty state */}
      {lines.length === 0 && (
        <div className="text-center py-6 space-y-1">
          <p className="text-sm text-muted-foreground">No ingredients yet</p>
          <p className="text-xs text-muted-foreground">
            Add your first ingredient or sub-recipe using the row below.
          </p>
        </div>
      )}

      {/* Sortable rows */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {lines.map((line) => {
            const isSubRecipe = line.input_type === 'recipe';
            return (
              <BomTableRow
                key={line.id}
                line={line}
                isLocked={isLocked}
                lineCost={calcLineCost(
                  line,
                  vendorPriceMap,
                  subRecipeCostMap,
                  conversionMap
                )}
                isSubRecipe={isSubRecipe}
                isExpanded={expandedRows.has(line.id)}
                subRecipeLines={
                  isSubRecipe
                    ? subRecipeLineMap.get(line.item_id) ?? []
                    : []
                }
                ingredientOptions={ingredientOptions}
                recipeOptions={recipeOptions}
                onToggleExpand={() => toggleExpand(line.id)}
                onChange={handleLineChange}
                onActivateGhost={handleActivateGhost}
                onRemove={handleRemove}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      {/* Ghost row */}
      {!isLocked && (
        <BomTableRow
          key={ghostIdRef.current}
          line={ghostLine}
          isGhost
          isLocked={isLocked}
          lineCost={null}
          isSubRecipe={false}
          isExpanded={false}
          subRecipeLines={[]}
          ingredientOptions={ingredientOptions}
          recipeOptions={recipeOptions}
          onToggleExpand={() => {}}
          onChange={() => {}}
          onActivateGhost={handleActivateGhost}
          onRemove={() => {}}
        />
      )}

      {/* Add Line button */}
      {!isLocked && (
        <Button
          variant="outline"
          size="sm"
          onClick={addNewLine}
          className="mt-2"
        >
          <Plus className="size-4 mr-1" /> Add Line
        </Button>
      )}
    </div>
  );
}
