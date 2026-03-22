'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { apiClient } from '@/lib/api-client';
import type { Ingredient } from '@/lib/types/ingredient';

interface Zone {
  id: string;
  name: string;
}

interface StockAdjustmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockAdjustmentSheet({ open, onOpenChange }: StockAdjustmentSheetProps) {
  const queryClient = useQueryClient();

  const [ingredientId, setIngredientId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => apiClient.get<Ingredient[]>('/ingredients'),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  const selectedIngredient = ingredients?.find((i) => i.id === ingredientId);

  const resetForm = () => {
    setIngredientId('');
    setZoneId('');
    setQuantity('');
    setReason('');
  };

  const mutation = useMutation({
    mutationFn: (data: { ingredient_id: string; zone_id: string; quantity: number; unit: string; reason: string }) =>
      apiClient.post('/inventory/adjust', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Stock adjusted.');
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast.error('Failed to save stock adjustment. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientId || !zoneId || !quantity || !reason.trim()) return;

    mutation.mutate({
      ingredient_id: ingredientId,
      zone_id: zoneId,
      quantity: Number(quantity),
      unit: selectedIngredient?.base_unit ?? '',
      reason: reason.trim(),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Adjust Stock</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 px-4 pb-4 overflow-y-auto">
          {/* Ingredient */}
          <div className="space-y-2">
            <Label>Ingredient</Label>
            <Select
              value={ingredientId}
              onValueChange={(v) => setIngredientId(v ?? '')}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select ingredient" />
              </SelectTrigger>
              <SelectContent>
                {ingredients?.map((ingredient) => (
                  <SelectItem key={ingredient.id} value={ingredient.id}>
                    {ingredient.name} ({ingredient.base_unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zone */}
          <div className="space-y-2">
            <Label>Zone</Label>
            <Select
              value={zoneId}
              onValueChange={(v) => setZoneId(v ?? '')}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones?.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="adjust-quantity">Quantity (negative to deduct)</Label>
            <Input
              id="adjust-quantity"
              type="number"
              step="0.01"
              placeholder="e.g. 50 or -10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="font-mono"
              required
              disabled={mutation.isPending}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="adjust-reason">Reason</Label>
            <Input
              id="adjust-reason"
              placeholder="e.g. Spillage, Received delivery"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              disabled={mutation.isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={mutation.isPending || !ingredientId || !zoneId || !quantity || !reason.trim()}
            >
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving...
                </span>
              ) : (
                'Save Adjustment'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { resetForm(); onOpenChange(false); }}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
