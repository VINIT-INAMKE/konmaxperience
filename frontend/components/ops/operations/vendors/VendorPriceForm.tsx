'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { apiClient } from '@/lib/api-client';
import type { Ingredient } from '@/lib/types/ingredient';
import type { VendorPrice } from '@/lib/types/vendor';

interface VendorPriceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  onSuccess: () => void;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function VendorPriceForm({
  open,
  onOpenChange,
  vendorId,
  onSuccess,
}: VendorPriceFormProps) {
  const queryClient = useQueryClient();

  const [ingredientId, setIngredientId] = useState('');
  const [price, setPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => apiClient.get<Ingredient[]>('/ingredients'),
    enabled: open,
  });

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);

  const handleClose = () => {
    setIngredientId('');
    setPrice('');
    setEffectiveDate(todayISO());
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientId || !price || !effectiveDate) return;

    setIsSubmitting(true);
    try {
      await apiClient.post<VendorPrice>('/vendors/prices', {
        vendor_id: vendorId,
        ingredient_id: ingredientId,
        price: Number(price),
        unit: selectedIngredient?.base_unit ?? 'g',
        effective_date: effectiveDate,
      });

      toast.success('Price added.');
      void queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] });
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
      handleClose();
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save vendor. Try again.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px]">
        <SheetHeader>
          <SheetTitle>Add Price</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4">
          {/* Ingredient */}
          <div className="space-y-2">
            <Label>Ingredient</Label>
            <Select
              value={ingredientId}
              onValueChange={(v) => setIngredientId(v ?? '')}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select ingredient" />
              </SelectTrigger>
              <SelectContent>
                {ingredients.map((ingredient) => (
                  <SelectItem key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="vendor-price">
              Price per base unit
              {selectedIngredient && (
                <span className="text-muted-foreground font-normal ml-1">
                  (per {selectedIngredient.base_unit})
                </span>
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₹
              </span>
              <Input
                id="vendor-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="pl-7"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Effective Date */}
          <div className="space-y-2">
            <Label htmlFor="vendor-price-date">Effective Date</Label>
            <Input
              id="vendor-price-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <ShimmerButton
              shimmerColor="#4ade80"
              type="submit"
              disabled={isSubmitting || !ingredientId || !price || !effectiveDate}
              className="h-9 text-sm px-4"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving...
                </span>
              ) : (
                'Add Price'
              )}
            </ShimmerButton>
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
