'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IngredientRow } from '@/components/ops/operations/ingredients/IngredientRow';
import { IngredientForm } from '@/components/ops/operations/ingredients/IngredientForm';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Ingredient, IngredientCategory } from '@/lib/types/ingredient';
import { INGREDIENT_CATEGORIES, INGREDIENT_CATEGORY_LABELS } from '@/lib/types/ingredient';
import type { IngredientStock } from '@/lib/types/inventory';

type CategoryFilter = 'all' | IngredientCategory;

export default function IngredientsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [deletingIngredient, setDeletingIngredient] = useState<Ingredient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: ingredients,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => apiClient.get<Ingredient[]>('/ingredients'),
  });

  const { data: stocks } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiClient.get<IngredientStock[]>('/inventory'),
  });

  const stockByIngredient = useMemo(() => {
    if (!stocks) return {} as Record<string, IngredientStock>;
    return stocks.reduce<Record<string, IngredientStock>>((acc, s) => {
      // If multiple stocks for same ingredient, keep the first (or the one with lowest quantity)
      if (!acc[s.ingredient_id] || s.current_quantity < acc[s.ingredient_id].current_quantity) {
        acc[s.ingredient_id] = s;
      }
      return acc;
    }, {});
  }, [stocks]);

  const filteredIngredients = useMemo(() => {
    if (!ingredients) return [];
    let result = ingredients;
    if (categoryFilter !== 'all') {
      result = result.filter((i) => i.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(query));
    }
    return result;
  }, [ingredients, categoryFilter, searchQuery]);

  const handleEditClick = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setFormOpen(true);
  };

  const handleAddClick = () => {
    setEditingIngredient(null);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingIngredient(null);
  };

  const handleFormSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['ingredients'] });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingIngredient) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/ingredients/${deletingIngredient.id}`);
      toast.success('Ingredient deleted.');
      void queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      setDeletingIngredient(null);
    } catch {
      toast.error('Something went wrong. Refresh the page or try again in a moment.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <BlurFade>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-[28px] font-semibold leading-tight">Ingredients</h1>
          <Button onClick={handleAddClick}>Add Ingredient</Button>
        </div>

        {/* Filter bar: category tabs + search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {INGREDIENT_CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat}>
                  {INGREDIENT_CATEGORY_LABELS[cat]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading ingredients...</div>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            Something went wrong. Refresh the page or try again in a moment.
          </div>
        )}

        {!isLoading && !isError && filteredIngredients.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <h2 className="text-base font-semibold">No ingredients yet</h2>
            <p className="text-sm text-muted-foreground">
              Add the raw ingredients your kitchen uses. Each ingredient has a base unit and minimum stock level.
            </p>
            <Button onClick={handleAddClick}>Add Ingredient</Button>
          </div>
        )}

        {!isLoading && !isError && filteredIngredients.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Base Unit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Min Stock Level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredIngredients.map((ingredient) => (
                  <IngredientRow
                    key={ingredient.id}
                    ingredient={ingredient}
                    stock={stockByIngredient[ingredient.id] ?? null}
                    isAdmin={isAdmin}
                    onEdit={handleEditClick}
                    onDelete={(i) => setDeletingIngredient(i)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ingredient create/edit Sheet */}
        <IngredientForm
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          ingredient={editingIngredient ?? undefined}
          onSuccess={handleFormSuccess}
        />

        {/* Delete confirmation Dialog */}
        <Dialog
          open={!!deletingIngredient}
          onOpenChange={(open) => { if (!open) setDeletingIngredient(null); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deletingIngredient?.name}?</DialogTitle>
              <DialogDescription>
                This ingredient will be permanently removed. Any recipe lines using it will break — check for usages first.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingIngredient(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Ingredient'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </BlurFade>
  );
}
