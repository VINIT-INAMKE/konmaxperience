'use client';

import { useState, useMemo } from 'react';
import { Plus, Loader2, UtensilsCrossed, LayoutList } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProductCategorySection } from '@/components/ops/operations/menu/ProductCategorySection';
import { ProductForm } from '@/components/ops/operations/menu/ProductForm';
import { ChannelModifierTable } from '@/components/ops/operations/menu/ChannelModifierTable';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Brand } from '@/lib/types/brand';
import { slugify } from '@/lib/types/catalog';
import type { ProductCategory, Product, ChannelModifier } from '@/lib/types/catalog';
import { ExportButton } from '@/components/ops/exports/ExportButton';

export default function MenuPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  // Brand tab state
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');

  // Menu item form state
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [itemFormCategoryId, setItemFormCategoryId] = useState<string>('');

  // Delete item dialog state
  const [deletingItem, setDeletingItem] = useState<Product | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Category form state
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Delete category dialog state
  const [deletingCategory, setDeletingCategory] = useState<ProductCategory | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Queries
  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: () => apiClient.get<Brand[]>('/brands'),
    select: (data) =>
      data.filter((b) => b.brand_type === 'food' && b.status === 'active'),
  });

  // Set default brand on first load
  const effectiveBrandId = selectedBrandId || brands[0]?.id || '';

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['menu-categories', effectiveBrandId],
    queryFn: () =>
      apiClient.get<ProductCategory[]>(`/catalog/categories?brand_id=${effectiveBrandId}`),
    enabled: !!effectiveBrandId,
  });

  const { data: products = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items', effectiveBrandId],
    queryFn: () =>
      apiClient.get<Product[]>(`/catalog/products/staff?brand_id=${effectiveBrandId}`),
    enabled: !!effectiveBrandId,
  });

  const { data: channelModifiers = [] } = useQuery({
    queryKey: ['channel-modifiers'],
    queryFn: () => apiClient.get<ChannelModifier[]>('/catalog/channel-modifiers'),
  });

  // Group items by category_id
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const item of products) {
      const existing = map.get(item.category_id) ?? [];
      map.set(item.category_id, [...existing, item]);
    }
    return map;
  }, [products]);

  // --- Handlers ---

  // `Product` has no `available` flag — publishing is the status transition
  // draft <-> active (SPEC 3.3), so the card's switch drives `status`.
  const handleToggleAvailability = async (item: Product, available: boolean) => {
    try {
      await apiClient.patch(`/catalog/products/${item.id}`, {
        status: available ? 'active' : 'draft',
      });
      const msg = available ? 'Product published.' : 'Product unpublished.';
      toast.success(msg);
      void queryClient.invalidateQueries({ queryKey: ['menu-items', effectiveBrandId] });
    } catch {
      toast.error('Failed to update availability. Try again.');
      // Re-invalidate to revert optimistic state
      void queryClient.invalidateQueries({ queryKey: ['menu-items', effectiveBrandId] });
    }
  };

  const handleAddItem = (categoryId: string) => {
    setEditingItem(null);
    setItemFormCategoryId(categoryId);
    setItemFormOpen(true);
  };

  const handleEditItem = (item: Product) => {
    setEditingItem(item);
    setItemFormCategoryId(item.category_id);
    setItemFormOpen(true);
  };

  const handleItemFormOpenChange = (open: boolean) => {
    setItemFormOpen(open);
    if (!open) setEditingItem(null);
  };

  const handleDeleteItemConfirm = async () => {
    if (!deletingItem) return;
    setIsDeletingItem(true);
    try {
      await apiClient.delete(`/catalog/products/${deletingItem.id}`);
      toast.success(`${deletingItem.name} removed from menu.`);
      void queryClient.invalidateQueries({ queryKey: ['menu-items', effectiveBrandId] });
      setDeletingItem(null);
    } catch {
      toast.error('Something went wrong. Refresh the page or try again in a moment.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Category form handlers
  const handleOpenCategoryForm = (category?: ProductCategory) => {
    setEditingCategory(category ?? null);
    setCategoryName(category?.name ?? '');
    setCategorySortOrder(category ? String(category.sort_order) : '');
    setCategoryFormOpen(true);
  };

  const handleCategoryFormClose = () => {
    setCategoryFormOpen(false);
    setEditingCategory(null);
    setCategoryName('');
    setCategorySortOrder('');
  };

  const handleCategoryFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        await apiClient.patch(`/catalog/categories/${editingCategory.id}`, {
          name: categoryName.trim(),
          slug: slugify(categoryName),
          sort_order: categorySortOrder ? parseInt(categorySortOrder) : undefined,
        });
        toast.success('Category updated.');
      } else {
        await apiClient.post('/catalog/categories', {
          name: categoryName.trim(),
          slug: slugify(categoryName),
          brand_id: effectiveBrandId,
          sort_order: categorySortOrder ? parseInt(categorySortOrder) : undefined,
        });
        toast.success('Category created.');
      }
      void queryClient.invalidateQueries({ queryKey: ['menu-categories', effectiveBrandId] });
      handleCategoryFormClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!deletingCategory) return;
    setIsDeletingCategory(true);
    try {
      await apiClient.delete(`/catalog/categories/${deletingCategory.id}`);
      toast.success(`Category "${deletingCategory.name}" deleted.`);
      void queryClient.invalidateQueries({ queryKey: ['menu-categories', effectiveBrandId] });
      void queryClient.invalidateQueries({ queryKey: ['menu-items', effectiveBrandId] });
      setDeletingCategory(null);
    } catch {
      toast.error('Something went wrong. Refresh the page or try again in a moment.');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const isLoading = brandsLoading || (!!effectiveBrandId && (categoriesLoading || itemsLoading));

  return (
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Menu</h1>
          <div className="flex items-center gap-2">
            <ExportButton
              reportType="products"
              reportName="Products"
              isTimeSeries={false}
            />
            {effectiveBrandId && (
              <Button onClick={() => handleOpenCategoryForm()}>
                <Plus className="size-4 mr-1" />
                Add Category
              </Button>
            )}
          </div>
        </div>

        {/* Brand tabs */}
        {!brandsLoading && brands.length > 0 && (
          <Tabs
            value={effectiveBrandId}
            onValueChange={(v) => setSelectedBrandId(v)}
          >
            <TabsList className="overflow-x-auto">
              {brands.map((brand) => (
                <TabsTrigger key={brand.id} value={brand.id}>
                  {brand.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            Loading menu...
          </div>
        )}

        {/* No food brands state */}
        {!brandsLoading && brands.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <UtensilsCrossed className="size-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">No Active Food Brands</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Create an active food brand in the Brands page to manage its menu.
            </p>
          </div>
        )}

        {/* Menu content */}
        {!isLoading && effectiveBrandId && (
          <div className="space-y-6">
            {/* No categories state */}
            {categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 border border-dashed rounded-lg">
                <LayoutList className="size-12 text-muted-foreground/30" />
                <h2 className="text-lg font-semibold">No Categories Yet</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Create a category for this brand to start organising products.
                </p>
                <Button
                  variant="outline"
                  onClick={() => handleOpenCategoryForm()}
                >
                  <Plus className="size-4 mr-1" />
                  Add Category
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {categories.map((category) => (
                  <ProductCategorySection
                    key={category.id}
                    category={category}
                    items={itemsByCategory.get(category.id) ?? []}
                    isAdmin={isAdmin}
                    onAddItem={handleAddItem}
                    onEditItem={handleEditItem}
                    onRemoveItem={(item) => setDeletingItem(item)}
                    onToggleAvailability={handleToggleAvailability}
                    onEditCategory={handleOpenCategoryForm}
                    onDeleteCategory={(cat) => setDeletingCategory(cat)}
                  />
                ))}
              </div>
            )}

            {/* Channel Modifiers */}
            <ChannelModifierTable modifiers={channelModifiers} />
          </div>
        )}

        {/* Product Form Sheet */}
        <ProductForm
          open={itemFormOpen}
          onOpenChange={handleItemFormOpenChange}
          categoryId={itemFormCategoryId}
          item={editingItem}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['menu-items', effectiveBrandId] });
          }}
        />

        {/* Category Form Sheet */}
        <Sheet open={categoryFormOpen} onOpenChange={(open) => { if (!open) handleCategoryFormClose(); }}>
          <SheetContent side="right" className="w-full sm:max-w-[480px]">
            <SheetHeader>
              <SheetTitle>
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => void handleCategoryFormSubmit(e)}
              className="space-y-4 mt-4 px-4"
            >
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  placeholder="e.g. Starters"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  required
                  disabled={isSavingCategory}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-sort">Sort Order (optional)</Label>
                <Input
                  id="category-sort"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={categorySortOrder}
                  onChange={(e) => setCategorySortOrder(e.target.value)}
                  disabled={isSavingCategory}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <ShimmerButton
                  shimmerColor="#4ade80"
                  type="submit"
                  disabled={isSavingCategory || !categoryName.trim()}
                  className="h-9 text-sm px-4"
                >
                  {isSavingCategory ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                      Saving...
                    </span>
                  ) : editingCategory ? (
                    'Save Changes'
                  ) : (
                    'Add Category'
                  )}
                </ShimmerButton>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCategoryFormClose}
                  disabled={isSavingCategory}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>

        {/* Delete Item Confirmation Dialog */}
        <Dialog
          open={!!deletingItem}
          onOpenChange={(open) => { if (!open) setDeletingItem(null); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove product</DialogTitle>
              <DialogDescription>
                Remove{' '}
                <span className="font-medium">{deletingItem?.name}</span> from
                menu? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingItem(null)}
                disabled={isDeletingItem}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteItemConfirm()}
                disabled={isDeletingItem}
              >
                {isDeletingItem ? 'Removing...' : 'Remove'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Category Confirmation Dialog */}
        <Dialog
          open={!!deletingCategory}
          onOpenChange={(open) => { if (!open) setDeletingCategory(null); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete category</DialogTitle>
              <DialogDescription>
                Delete category{' '}
                <span className="font-medium">{deletingCategory?.name}</span>?
                All items in this category will also be deleted. This cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingCategory(null)}
                disabled={isDeletingCategory}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteCategoryConfirm()}
                disabled={isDeletingCategory}
              >
                {isDeletingCategory ? 'Deleting...' : 'Delete Category'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
