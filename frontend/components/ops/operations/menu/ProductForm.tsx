'use client';

import { useMemo, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FoodCostBadge } from './FoodCostBadge';
import { MediaManager } from './MediaManager';
import { VariantEditor } from './VariantEditor';
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

type FormTab = 'details' | 'variants' | 'media';

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  item?: Product | null;
  onSuccess: () => void;
  /**
   * Fired once, with the freshly created product. The page switches the sheet
   * from "add" to "edit" on it so variants and media can be attached without
   * closing and reopening — they need a product id that only exists after the
   * first save.
   */
  onCreated?: (product: Product) => void;
}

export function ProductForm({
  open,
  onOpenChange,
  categoryId,
  item,
  onSuccess,
  onCreated,
}: ProductFormProps) {
  // Held out here so it survives the remount that follows a create.
  const [tab, setTab] = useState<FormTab>('details');

  const handleCreated = (product: Product) => {
    setTab('variants');
    onCreated?.(product);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setTab('details');
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle>{item ? 'Edit Product' : 'Add Product'}</SheetTitle>
        </SheetHeader>
        {/* Keying on the product resets every field without a populate effect,
            so a background refetch of the catalog can refresh `item.variants`
            and `item.media` underneath the form without wiping what is typed. */}
        <ProductFormBody
          key={`${item?.id ?? 'new'}:${categoryId}`}
          open={open}
          categoryId={categoryId}
          item={item ?? null}
          tab={tab}
          onTabChange={setTab}
          onClose={() => handleOpenChange(false)}
          onSuccess={onSuccess}
          onCreated={handleCreated}
        />
      </SheetContent>
    </Sheet>
  );
}

interface ProductFormBodyProps {
  open: boolean;
  categoryId: string;
  item: Product | null;
  tab: FormTab;
  onTabChange: (tab: FormTab) => void;
  onClose: () => void;
  onSuccess: () => void;
  onCreated: (product: Product) => void;
}

function ProductFormBody({
  open,
  categoryId,
  item,
  tab,
  onTabChange,
  onClose,
  onSuccess,
  onCreated,
}: ProductFormBodyProps) {
  const queryClient = useQueryClient();
  const isEditing = !!item;

  const [name, setName] = useState(item?.name ?? '');
  const [slug, setSlug] = useState(item?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!item);
  const [type, setType] = useState<ProductType>(item?.type ?? 'prepared_food');
  const [recipeId, setRecipeId] = useState(item?.recipe_id ?? '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(item?.category_id ?? categoryId);
  const [basePrice, setBasePrice] = useState(item ? String(item.base_price) : '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [isActive, setIsActive] = useState(item ? item.status === 'active' : true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        void queryClient.invalidateQueries({ queryKey: ['menu-items'] });
        onSuccess();
        onClose();
      } else {
        const created = await apiClient.post<Product>('/catalog/products', payload);
        toast.success('Product added. Variants and media are available now.');
        void queryClient.invalidateQueries({ queryKey: ['menu-items'] });
        onSuccess();
        onCreated(created);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Variants and media hang off a product id, so they only exist after the
  // first save. The tabs say so rather than silently doing nothing.
  const catalogTabsEnabled = isEditing;
  const variantCount = item?.variants?.filter((v) => v.status !== 'archived').length ?? 0;
  const mediaCount = item?.media?.length ?? 0;

  const refreshProduct = () => {
    void queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    onSuccess();
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => onTabChange((v as FormTab) ?? 'details')}
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <TabsList className="mx-4 w-auto overflow-x-auto">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="variants" disabled={!catalogTabsEnabled}>
          Variants{variantCount > 0 ? ` (${variantCount})` : ''}
        </TabsTrigger>
        <TabsTrigger value="media" disabled={!catalogTabsEnabled}>
          Media{mediaCount > 0 ? ` (${mediaCount})` : ''}
        </TabsTrigger>
      </TabsList>

      {/* `keepMounted` is load-bearing: Base UI unmounts a hidden panel by
          default, so without it a trip to Variants and back would silently
          discard everything typed into Details. */}
      <TabsContent value="details" keepMounted className="min-h-0 flex-1 overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-4 pb-4">
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
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="variants" keepMounted className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pb-4">
          {item ? (
            <VariantEditor
              productId={item.id}
              basePrice={item.base_price}
              stockMode={item.stock_mode}
              variants={item.variants ?? []}
              onChanged={refreshProduct}
            />
          ) : (
            <p className="text-sm text-ink-muted">Save the product first, then add its variants.</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="media" keepMounted className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pb-4">
          {item ? (
            <MediaManager
              productId={item.id}
              media={item.media ?? []}
              onChanged={refreshProduct}
            />
          ) : (
            <p className="text-sm text-ink-muted">Save the product first, then upload its images.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
