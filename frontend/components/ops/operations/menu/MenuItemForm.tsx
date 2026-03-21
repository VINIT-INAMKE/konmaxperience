'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { FoodCostBadge } from './FoodCostBadge';
import { apiClient } from '@/lib/api-client';
import { calcFoodCostPercent } from '@/lib/types/menu';
import type { MenuItem, MenuCategory } from '@/lib/types/menu';
import type { Recipe } from '@/lib/types/recipe';

interface MenuItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  item?: MenuItem | null;
  onSuccess: () => void;
}

export function MenuItemForm({
  open,
  onOpenChange,
  categoryId,
  item,
  onSuccess,
}: MenuItemFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!item;

  const [recipeId, setRecipeId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId);
  const [basePrice, setBasePrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [available, setAvailable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (item) {
      setRecipeId(item.recipe_id);
      setSelectedCategoryId(item.category_id);
      setBasePrice(String(item.base_price));
      setImageUrl(item.image_url ?? '');
      setAvailable(item.available);
    } else {
      setRecipeId('');
      setSelectedCategoryId(categoryId);
      setBasePrice('');
      setImageUrl('');
      setAvailable(true);
    }
  }, [item, categoryId, open]);

  // Query approved recipes only
  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes', 'approved'],
    queryFn: () => apiClient.get<Recipe[]>('/recipes?status=approved'),
    enabled: open,
  });

  // Query all menu categories
  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: () => apiClient.get<MenuCategory[]>('/menu/categories'),
    enabled: open,
  });

  // Compute live food cost %
  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === recipeId) ?? null,
    [recipes, recipeId],
  );

  const parsedPrice = parseFloat(basePrice);
  const liveFoodCostPercent = useMemo(() => {
    if (!selectedRecipe || !parsedPrice || isNaN(parsedPrice)) return null;
    return calcFoodCostPercent(selectedRecipe.computed_cost, parsedPrice);
  }, [selectedRecipe, parsedPrice]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeId || !selectedCategoryId || !basePrice) return;

    setIsSubmitting(true);
    try {
      if (isEditing && item) {
        await apiClient.patch<MenuItem>(`/menu/items/${item.id}`, {
          recipe_id: recipeId,
          category_id: selectedCategoryId,
          base_price: parseFloat(basePrice),
          image_url: imageUrl.trim() || null,
          available,
        });
        toast.success('Menu item updated.');
      } else {
        await apiClient.post<MenuItem>('/menu/items', {
          recipe_id: recipeId,
          category_id: selectedCategoryId,
          base_price: parseFloat(basePrice),
          image_url: imageUrl.trim() || null,
          available,
        });
        toast.success('Menu item added.');
      }
      void queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      handleClose();
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Menu Item' : 'Add Menu Item'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4">
          {/* Recipe — approved only */}
          <div className="space-y-2">
            <Label>Recipe (approved only)</Label>
            <Select
              value={recipeId}
              onValueChange={(v) => setRecipeId(v ?? '')}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select approved recipe" />
              </SelectTrigger>
              <SelectContent>
                {recipes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {recipes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No approved recipes available. Approve a recipe before adding menu items.
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={selectedCategoryId}
              onValueChange={(v) => setSelectedCategoryId(v ?? '')}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base Price */}
          <div className="space-y-2">
            <Label htmlFor="base-price">Base Price (INR)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">INR</span>
              <Input
                id="base-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Live food cost % */}
          {(recipeId || basePrice) && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Food Cost %</Label>
              <div className="flex items-center h-8">
                <FoodCostBadge percent={liveFoodCostPercent} />
              </div>
            </div>
          )}

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="image-url">Image URL (optional)</Label>
            <Input
              id="image-url"
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Availability */}
          <div className="flex items-center gap-3">
            <Switch
              id="item-available"
              checked={available}
              onCheckedChange={setAvailable}
              disabled={isSubmitting}
            />
            <Label htmlFor="item-available">Available</Label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <ShimmerButton
              shimmerColor="#4ade80"
              type="submit"
              disabled={isSubmitting || !recipeId || !selectedCategoryId || !basePrice}
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
                'Add Item'
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
