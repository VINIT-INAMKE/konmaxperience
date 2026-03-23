'use client';

import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Ingredient } from '@/lib/types/ingredient';

export interface LineItemState {
  ingredient_id: string;
  quantity: string;
  unit: string;
  unit_cost: string;
}

const COMMON_UNITS = ['g', 'kg', 'ml', 'L', 'pieces', 'dozen'] as const;

interface PurchaseOrderLineRowProps {
  line: LineItemState;
  index: number;
  ingredients: Ingredient[];
  onUpdate: (index: number, field: string, value: string) => void;
  onRemove: (index: number) => void;
}

export function PurchaseOrderLineRow({
  line,
  index,
  ingredients,
  onUpdate,
  onRemove,
}: PurchaseOrderLineRowProps) {
  const lineTotal =
    Number(line.quantity) > 0 && Number(line.unit_cost) > 0
      ? (Number(line.quantity) * Number(line.unit_cost)).toLocaleString('en-IN')
      : '0';

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-start py-2 border-b border-border last:border-0">
      {/* Ingredient */}
      <Select
        value={line.ingredient_id}
        onValueChange={(v) => onUpdate(index, 'ingredient_id', v ?? '')}
      >
        <SelectTrigger className="w-full h-9 text-xs">
          <SelectValue placeholder="Select ingredient">
            {(value: string) => {
              if (!value) return 'Select ingredient';
              return ingredients.find(i => i.id === value)?.name ?? 'Select ingredient';
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ingredients.map((ing) => (
            <SelectItem key={ing.id} value={ing.id}>
              {ing.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quantity */}
      <Input
        type="number"
        min="0.001"
        step="any"
        placeholder="Qty"
        value={line.quantity}
        onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
        className="h-9 text-xs font-mono"
      />

      {/* Unit */}
      <Select
        value={line.unit}
        onValueChange={(v) => onUpdate(index, 'unit', v ?? '')}
      >
        <SelectTrigger className="w-full h-9 text-xs">
          <SelectValue placeholder="Unit" />
        </SelectTrigger>
        <SelectContent>
          {COMMON_UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Unit Cost */}
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          INR
        </span>
        <Input
          type="number"
          min="0"
          step="any"
          placeholder="0"
          value={line.unit_cost}
          onChange={(e) => onUpdate(index, 'unit_cost', e.target.value)}
          className="h-9 text-xs font-mono pl-9"
        />
      </div>

      {/* Line Total */}
      <div className="flex items-center h-9 px-2 text-xs font-mono text-muted-foreground">
        {lineTotal}
      </div>

      {/* Remove */}
      <button
        type="button"
        className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors mt-0.5"
        onClick={() => onRemove(index)}
        aria-label="Remove line item"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
