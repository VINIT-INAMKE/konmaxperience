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
import { FoodCostBadge } from './FoodCostBadge';
import { apiClient } from '@/lib/api-client';
import {
  calcFoodCostPercent,
  slugify,
  PRODUCT_TYPE_DEFAULTS,
  PRODUCT_TYPE_LABELS,
} from '@/lib/types/catalog';
import type { Product, ProductCategory, ProductType } from '@/lib/types/catalog';
import type { Recipe } from '@/lib/types/recipe';

const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_DEFAULTS) as ProductType[];

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  item?: Product | null;
  onSuccess: () => void;
}

export function ProductForm({
  open,
  onOpenChange,
  categoryId,
  item,
  onSuccess,
}: ProductFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!item;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [type, setType] = useState<ProductType>('prepared_food');
  const [recipeId, setRecipeId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId);
  const [basePrice, setBasePrice] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (item) {
      setName(item.name);
      setSlug(item.slug);
      setSlugTouched(true);
      setType(item.type);
      setRecipeId(item.recipe_id ?? '');
      setSelectedCategoryId(item.category_id);
      setBasePrice(String(item.base_price));
      setDescription(item.description ?? '');
      setIsActive(item.status === 'active');
    } else {
      setName('');
      setSlug('');
      setSlugTouched(false);
      setType('prepared_food');
      setRecipeId('');
      setSelectedCategoryId(categoryId);
      setBasePrice('');
      setDescription('');
      setIsActive(true);
    }
  }, [item, categoryId, open]);

  // Query approved recipes only
  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes', 'approved'],
    queryFn: () => apiClient.get<Recipe[]>('/recipes?status=approved'),
    enabled: open,
  });

  // Query all product categories
  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: () => apiClient.get<ProductCategory[]>('/catalog/categories'),
    enabled: open,
  });

  const typeDefaults = PRODUCT_TYPE_DEFAULTS[type];
  const requiresRecipe = typeDefaults.requires_recipe;

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

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

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const brandId = selectedCategory?.brand_id ?? item?.brand_id ?? '';

  const canSubmit =
    !!name.trim() &&
    !!effectiveSlug &&
    !!selectedCategoryId &&
    !!brandId &&
    !!basePrice &&
    (!requiresRecipe || !!recipeId);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const payload = {
        brand_id: brandId,
        category_id: selectedCategoryId,
        type,
        name: name.trim(),
        slug: effectiveSlug,
        base_price: parseFloat(basePrice),
        fulfilment: typeDefaults.fulfilment,
        stock_mode: typeDefaults.stock_mode,
        status: isActive ? ('active' as const) : ('draft' as const),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(requiresRecipe && recipeId ? { recipe_id: recipeId } : {}),
      };

      if (isEditing && item) {
        await apiClient.patch<Product>(`/catalog/products/${item.id}`, payload);
        toast.success('Product updated.');
      } else {
        await apiClient.post<Product>('/catalog/products', payload);
        toast.success('Product added.');
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
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Product' : 'Add Product'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4 pb-4 overflow-y-auto">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              placeholder="e.g. Sourdough Loaf"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="product-slug">Slug</Label>
            <Input
              id="product-slug"
              placeholder="sourdough-loaf"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Used in the storefront URL. Lowercase letters, numbers and hyphens.
            </p>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType((v as ProductType) ?? 'prepared_food')}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type">
                  {(value: string) =>
                    PRODUCT_TYPE_LABELS[value as ProductType] ?? 'Select type'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PRODUCT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Fulfilment {typeDefaults.fulfilment.replace('_', ' ')} &middot; stock{' '}
              {typeDefaults.stock_mode.replace(/_/g, ' ')}
            </p>
          </div>

          {/* Recipe — approved only, recipe-backed types only */}
          {requiresRecipe && (
            <div className="space-y-2">
              <Label>Recipe (approved only)</Label>
              <Select
                value={recipeId}
                onValueChange={(v) => setRecipeId(v ?? '')}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select approved recipe">
                    {(value: string) => {
                      if (!value) return 'Select approved recipe';
                      return recipes.find(r => r.id === value)?.name ?? 'Select approved recipe';
                    }}
                  </SelectValue>
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
                  No approved recipes available. Approve a recipe before adding products.
                </p>
              )}
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={selectedCategoryId}
              onValueChange={(v) => setSelectedCategoryId(v ?? '')}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category">
                  {(value: string) => {
                    if (!value) return 'Select category';
                    return categories.find(c => c.id === value)?.name ?? 'Select category';
                  }}
                </SelectValue>
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
          {requiresRecipe && (recipeId || basePrice) && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Food Cost %</Label>
              <div className="flex items-center h-8">
                <FoodCostBadge percent={liveFoodCostPercent} />
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="product-description">Description (optional)</Label>
            <Input
              id="product-description"
              placeholder="Short storefront description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Published */}
          <div className="flex items-center gap-3">
            <Switch
              id="product-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isSubmitting}
            />
            <Label htmlFor="product-active">Published</Label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || !canSubmit}
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
                'Add Product'
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
