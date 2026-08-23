'use client';

import { useState, useEffect } from 'react';
import { Loader2, Wheat, Package, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiClient } from '@/lib/api-client';
import type { Ingredient, IngredientCategoryItem, UsageType } from '@/lib/types/ingredient';
import { BASE_UNITS } from '@/lib/types/ingredient';

interface IngredientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient?: Ingredient;
  onSuccess: () => void;
}

const USAGE_TYPE_OPTIONS = [
  { value: 'recipe_input' as const, icon: <Wheat className="size-4" />, label: 'Recipe Ingredient' },
  { value: 'supply' as const, icon: <Package className="size-4" />, label: 'Disposable Supply' },
  { value: 'equipment' as const, icon: <Wrench className="size-4" />, label: 'Reusable Equipment' },
];

export function IngredientForm({
  open,
  onOpenChange,
  ingredient,
  onSuccess,
}: IngredientFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!ingredient;

  const [name, setName] = useState('');
  const [usageType, setUsageType] = useState<UsageType>('recipe_input');
  const [categoryId, setCategoryId] = useState('');
  const [baseUnit, setBaseUnit] = useState<typeof BASE_UNITS[number] | ''>('');
  const [minStockLevel, setMinStockLevel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['ingredient-categories'],
    queryFn: () => apiClient.get<IngredientCategoryItem[]>('/ingredient-categories'),
  });

  useEffect(() => {
    if (ingredient) {
      setName(ingredient.name);
      setUsageType(ingredient.usage_type ?? 'recipe_input');
      setCategoryId(ingredient.category_id ?? '');
      setBaseUnit(ingredient.base_unit as typeof BASE_UNITS[number]);
      setMinStockLevel(String(ingredient.min_stock_level));
    } else {
      setName('');
      setUsageType('recipe_input');
      setCategoryId('');
      setBaseUnit('');
      setMinStockLevel('');
    }
  }, [ingredient, open]);

  const handleClose = () => {
    setName('');
    setUsageType('recipe_input');
    setCategoryId('');
    setBaseUnit('');
    setMinStockLevel('');
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseUnit) return;

    setIsSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        usage_type: usageType,
        category_id: categoryId || undefined,
        base_unit: baseUnit,
        min_stock_level: Number(minStockLevel) || 0,
      };

      if (isEditing && ingredient) {
        await apiClient.patch<Ingredient>(`/ingredients/${ingredient.id}`, body);
        toast.success('Ingredient updated.');
      } else {
        await apiClient.post<Ingredient>('/ingredients', body);
        toast.success('Ingredient added.');
      }

      void queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      handleClose();
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save ingredient. Try again.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Ingredient' : 'Add Ingredient'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4 pb-4 overflow-y-auto">
          {/* Item Type (usage_type) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide font-normal">
              Item Type
            </Label>
            <RadioGroup
              value={usageType}
              onValueChange={(v) => setUsageType(v as UsageType)}
              disabled={isSubmitting}
              className="grid grid-cols-3 gap-2"
            >
              {USAGE_TYPE_OPTIONS.map((opt) => {
                const isSelected = usageType === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 min-h-[48px] cursor-pointer transition-colors text-center ${
                      isSelected
                        ? 'border-brand bg-brand/5 text-ink font-medium'
                        : 'border-border bg-transparent text-muted-foreground'
                    } ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <RadioGroupItem value={opt.value} className="sr-only" />
                    {opt.icon}
                    <span className="text-xs">{opt.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
            {(usageType === 'supply' || usageType === 'equipment') && (
              <p className="text-xs text-warning mt-1">
                This item will not appear in recipe BOM lines or availability calculations.
              </p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="ingredient-name">Name</Label>
            <Input
              id="ingredient-name"
              placeholder="e.g. Chicken Breast"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Category (DB-driven) */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => setCategoryId(v ?? '')}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category">
                  {(value: string) => {
                    if (!value) return 'Select category';
                    return categories.find((c) => c.id === value)?.name ?? 'Select category';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base Unit */}
          <div className="space-y-2">
            <Label>Base Unit</Label>
            <Select
              value={baseUnit}
              onValueChange={(v) => setBaseUnit(v as typeof BASE_UNITS[number])}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {BASE_UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Min Stock Level */}
          <div className="space-y-2">
            <Label htmlFor="ingredient-min-stock">Min Stock Level</Label>
            <Input
              id="ingredient-min-stock"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 500"
              value={minStockLevel}
              onChange={(e) => setMinStockLevel(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !baseUnit}
              className="h-9 text-sm px-4"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving...
                </span>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Add Ingredient'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
