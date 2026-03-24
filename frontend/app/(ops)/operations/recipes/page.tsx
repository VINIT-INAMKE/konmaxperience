'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ChefHat } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RecipeCard } from '@/components/ops/operations/recipes/RecipeCard';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Recipe, RecipeStatus } from '@/lib/types/recipe';
import { RECIPE_STATUS_LABELS } from '@/lib/types/recipe';
import { ExportButton } from '@/components/ops/exports/ExportButton';
import type { Brand } from '@/lib/types/brand';

type StatusFilter = 'all' | RecipeStatus;

export default function RecipesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [archivingRecipe, setArchivingRecipe] = useState<Recipe | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const {
    data: recipes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiClient.get<Recipe[]>('/recipes'),
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => apiClient.get<Brand[]>('/brands'),
  });

  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];
    let result = recipes;
    if (brandFilter !== 'all') {
      result = result.filter((r) => r.brand_id === brandFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }
    return result;
  }, [recipes, brandFilter, statusFilter, searchQuery]);

  const handleArchiveConfirm = async () => {
    if (!archivingRecipe) return;
    setIsArchiving(true);
    try {
      await apiClient.patch(`/recipes/${archivingRecipe.id}`, { status: 'archived' });
      toast.success('Recipe archived.');
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setArchivingRecipe(null);
    } catch {
      toast.error('Something went wrong. Refresh the page or try again in a moment.');
    } finally {
      setIsArchiving(false);
    }
  };

  const hasFilters = brandFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim() !== '';

  return (
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Recipes</h1>
          <Link href="/operations/recipes/new">
            <Button size="sm">Create Recipe</Button>
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={brandFilter} onValueChange={(v) => setBrandFilter(v ?? 'all')}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All brands">
                {(value: string) => {
                  if (!value || value === 'all') return 'All Brands';
                  return brands.find(b => b.id === value)?.name ?? 'All Brands';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">{RECIPE_STATUS_LABELS.draft}</SelectItem>
              <SelectItem value="pending">{RECIPE_STATUS_LABELS.pending}</SelectItem>
              <SelectItem value="approved">{RECIPE_STATUS_LABELS.approved}</SelectItem>
              <SelectItem value="archived">{RECIPE_STATUS_LABELS.archived}</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-64 ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <ExportButton
            reportType="recipes"
            reportName="Recipes"
            isTimeSeries={false}
          />
        </div>

        {/* Content */}
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading recipes...</div>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            Something went wrong. Refresh the page or try again in a moment.
          </div>
        )}
        {!isLoading && !isError && filteredRecipes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <ChefHat className="size-12 text-muted-foreground/30" />
            {hasFilters ? (
              <>
                <h2 className="text-lg font-semibold">No Recipes Match</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Try adjusting the brand, status, or search filters.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">No Recipes Yet</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Create your first recipe to get started with the food menu.
                </p>
              </>
            )}
          </div>
        )}
        {!isLoading && !isError && filteredRecipes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onArchive={(r) => setArchivingRecipe(r)}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}

        {/* Archive confirmation Dialog */}
        <Dialog
          open={!!archivingRecipe}
          onOpenChange={(open) => { if (!open) setArchivingRecipe(null); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive this recipe?</DialogTitle>
              <DialogDescription>
                Archiving &quot;{archivingRecipe?.name}&quot; will hide it from active use. You can restore it
                later by changing its status back to draft or approved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setArchivingRecipe(null)}
                disabled={isArchiving}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleArchiveConfirm()}
                disabled={isArchiving}
              >
                {isArchiving ? 'Archiving...' : 'Archive Recipe'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
