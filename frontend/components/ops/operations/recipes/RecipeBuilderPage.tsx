'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { RecipeStatusBadge } from '@/components/ops/operations/recipes/RecipeStatusBadge';
import { RecipeMetaGrid } from '@/components/ops/operations/recipes/builder/RecipeMetaGrid';
import { apiClient } from '@/lib/api-client';
import type { Recipe, RecipeStatus, BomLineState } from '@/lib/types/recipe';
import type { Brand } from '@/lib/types/brand';
import type { Zone } from '@/lib/types/zone';

interface RecipeBuilderPageProps {
  recipeId?: string;
}

export function RecipeBuilderPage({ recipeId }: RecipeBuilderPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // --- State ---
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prepSteps, setPrepSteps] = useState('');
  const [cookingMethod, setCookingMethod] = useState('');
  const [yieldQty, setYieldQty] = useState('');
  const [yieldUnit, setYieldUnit] = useState('g');
  const [portionSize, setPortionSize] = useState('');
  const [shelfLifeHours, setShelfLifeHours] = useState('');
  const [brandId, setBrandId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<RecipeStatus>('draft');
  const [bomLines, setBomLines] = useState<BomLineState[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isLocked = status === 'approved' || status === 'archived';

  // --- Data fetching ---
  const {
    data: recipe,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => apiClient.get<Recipe>(`/recipes/${recipeId}`),
    enabled: !!recipeId,
  });

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => apiClient.get<Brand[]>('/brands'),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  // --- Populate state from fetched recipe ---
  useEffect(() => {
    if (recipe) {
      setName(recipe.name);
      setDescription(recipe.description ?? '');
      setPrepSteps(recipe.prep_steps ?? '');
      setCookingMethod(recipe.cooking_method ?? '');
      setYieldQty(String(recipe.yield_qty ?? ''));
      setYieldUnit(recipe.yield_unit ?? 'g');
      setPortionSize(recipe.portion_size ?? '');
      setShelfLifeHours(
        recipe.shelf_life_hours != null ? String(recipe.shelf_life_hours) : ''
      );
      setBrandId(recipe.brand_id);
      setZoneId(recipe.zone_id);
      setImageUrl(recipe.image_url ?? '');
      setStatus(recipe.status);
      setBomLines(
        (recipe.RecipeLines ?? []).map((line) => ({
          id: line.id,
          input_type: line.input_type,
          item_id:
            line.input_type === 'ingredient'
              ? (line.ingredient_id ?? '')
              : (line.source_recipe_id ?? ''),
          item_name:
            line.input_type === 'ingredient'
              ? (line.ingredient?.name ?? '')
              : (line.source_recipe?.name ?? ''),
          quantity: String(line.quantity),
          unit: line.unit,
          prep_notes: line.prep_notes ?? '',
          sort_order: line.sort_order,
        }))
      );
      setIsDirty(false);
    }
  }, [recipe]);

  // --- Unsaved changes guard ---
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // --- Save mutation ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        prep_steps: prepSteps,
        cooking_method: cookingMethod,
        yield_qty: parseFloat(yieldQty) || 0,
        yield_unit: yieldUnit,
        portion_size: portionSize,
        shelf_life_hours: shelfLifeHours
          ? parseInt(shelfLifeHours, 10)
          : undefined,
        brand_id: brandId || undefined,
        zone_id: zoneId || undefined,
        image_url: imageUrl || undefined,
        bom_lines: bomLines
          .filter((l) => l.item_id)
          .map((l) => ({
            input_type: l.input_type,
            item_id: l.item_id,
            quantity: parseFloat(l.quantity) || 0,
            unit: l.unit,
            prep_notes: l.prep_notes || undefined,
          })),
      };

      if (recipeId) {
        return apiClient.patch<Recipe>(`/recipes/${recipeId}`, payload);
      }
      return apiClient.post<Recipe>('/recipes', payload);
    },
    onSuccess: (data) => {
      setIsDirty(false);
      toast.success('Recipe saved.');
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      if (recipeId) {
        void queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
      } else {
        router.push(`/operations/recipes/${data.id}`);
      }
    },
    onError: () => {
      toast.error('Failed to save. Check your connection and try again.');
    },
  });

  const handleSave = useCallback(() => {
    if (isSaving || isLocked) return;
    setIsSaving(true);
    saveMutation.mutate(undefined, {
      onSettled: () => setIsSaving(false),
    });
  }, [isSaving, isLocked, saveMutation]);

  // --- Metadata change handler ---
  const handleMetaChange = useCallback(
    (field: string, value: string) => {
      setIsDirty(true);
      switch (field) {
        case 'brandId':
          setBrandId(value || null);
          break;
        case 'zoneId':
          setZoneId(value || null);
          break;
        case 'yieldQty':
          setYieldQty(value);
          break;
        case 'yieldUnit':
          setYieldUnit(value);
          break;
        case 'portionSize':
          setPortionSize(value);
          break;
        case 'shelfLifeHours':
          setShelfLifeHours(value);
          break;
        case 'description':
          setDescription(value);
          break;
        default:
          break;
      }
    },
    []
  );

  // --- Loading state ---
  if (recipeId && isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between gap-4 mb-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        <Skeleton className="h-10 w-64 mb-2" />
        <Separator className="my-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
            <Separator />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (recipeId && isError) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-8 space-y-3">
        <div className="text-sm text-destructive">
          Could not load recipe. It may have been deleted or you don&apos;t have
          access.
        </div>
        <Link
          href="/operations/recipes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Recipes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      {/* Page header: back link + unsaved indicator + status badge + save button */}
      <div className="flex items-center justify-between gap-4 mb-2">
        <Link
          href="/operations/recipes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Recipes
        </Link>
        <div className="flex items-center gap-3">
          {isDirty && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-amber-500" />
              Unsaved changes
            </div>
          )}
          <RecipeStatusBadge status={status} />
          <Button
            onClick={handleSave}
            disabled={isSaving || isLocked}
            size="sm"
          >
            {isSaving ? 'Saving...' : 'Save Recipe'}
          </Button>
        </div>
      </div>

      {/* Recipe name -- large editable field (Display 28px/600) */}
      <input
        className={cn(
          'text-[28px] font-semibold leading-[1.15] bg-transparent border-0 outline-none w-full mb-2',
          'border-b border-transparent hover:border-border focus:border-[var(--primary)]',
          'transition-colors placeholder:text-muted-foreground/40',
          isLocked && 'pointer-events-none opacity-70'
        )}
        placeholder="Recipe name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setIsDirty(true);
        }}
        disabled={isLocked}
      />

      {/* Status banner slot -- Plan 04 will create RecipeStatusBanner here */}

      <Separator className="my-6" />

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Left column (main content) */}
        <div className="space-y-6">
          <RecipeMetaGrid
            brandId={brandId}
            zoneId={zoneId}
            yieldQty={yieldQty}
            yieldUnit={yieldUnit}
            portionSize={portionSize}
            shelfLifeHours={shelfLifeHours}
            description={description}
            brands={brands ?? []}
            zones={zones ?? []}
            isLocked={isLocked}
            onChange={handleMetaChange}
          />

          <Separator />

          {/* BOM table slot -- Plan 03 will create RecipeBomTable here */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Bill of Materials</h2>
            <p className="text-sm text-muted-foreground">
              BOM table will be added in Plan 03.
            </p>
          </div>

          <Separator />

          {/* Prep steps and cooking method */}
          <div className="space-y-4">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                Prep Steps
              </label>
              <textarea
                className="text-sm bg-transparent border border-transparent hover:border-border focus:border-[var(--primary)] outline-none transition-colors rounded-md p-2 min-h-[80px] resize-y disabled:pointer-events-none disabled:opacity-50"
                value={prepSteps}
                onChange={(e) => {
                  setPrepSteps(e.target.value);
                  setIsDirty(true);
                }}
                disabled={isLocked}
                placeholder="Preparation steps..."
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                Cooking Method
              </label>
              <textarea
                className="text-sm bg-transparent border border-transparent hover:border-border focus:border-[var(--primary)] outline-none transition-colors rounded-md p-2 min-h-[80px] resize-y disabled:pointer-events-none disabled:opacity-50"
                value={cookingMethod}
                onChange={(e) => {
                  setCookingMethod(e.target.value);
                  setIsDirty(true);
                }}
                disabled={isLocked}
                placeholder="Cooking method..."
              />
            </div>
          </div>
        </div>

        {/* Right column (sticky cost panel) -- Plan 04 will create RecipeCostPanel here */}
        <div className="hidden lg:block">
          <div className="sticky top-[64px] self-start">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold">Cost Preview</h2>
              <p className="text-sm text-muted-foreground">
                Cost panel will be added in Plan 04.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
