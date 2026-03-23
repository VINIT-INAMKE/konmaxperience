'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UtensilsCrossed } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MenuBrandTabs } from '@/components/public/MenuBrandTabs';
import { MenuItemPublicCard } from '@/components/public/MenuItemPublicCard';
import { apiClient } from '@/lib/api-client';
import type { MenuCategory, MenuItem } from '@/lib/types/menu';

interface AvailabilityMap {
  [itemId: string]: { available: boolean; servings_remaining: number };
}

export default function MenuPage() {
  const [activeBrandId, setActiveBrandId] = useState<string>('');

  const {
    data: brands = [],
    isLoading: brandsLoading,
    error: brandsError,
    refetch: refetchBrands,
  } = useQuery({
    queryKey: ['public-brands'],
    queryFn: () =>
      apiClient.get<{ id: string; name: string }[]>('/brands'),
  });

  const {
    data: categories = [],
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['public-menu-categories'],
    queryFn: () => apiClient.get<MenuCategory[]>('/menu/categories'),
  });

  const {
    data: items = [],
    isLoading: itemsLoading,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['public-menu-items'],
    queryFn: () => apiClient.get<MenuItem[]>('/menu/items'),
  });

  const { data: availability = {} } = useQuery({
    queryKey: ['public-menu-availability'],
    queryFn: () =>
      apiClient.get<AvailabilityMap>('/menu/availability'),
    refetchInterval: 60_000,
  });

  // Set default brand to first brand
  const effectiveBrandId = activeBrandId || brands[0]?.id || '';

  // Filter categories by active brand
  const filteredCategories = useMemo(
    () =>
      categories
        .filter((c) => c.brand_id === effectiveBrandId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories, effectiveBrandId]
  );

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      if (
        item.category?.brand_id === effectiveBrandId ||
        filteredCategories.some((c) => c.id === item.category_id)
      ) {
        const existing = map.get(item.category_id) ?? [];
        map.set(item.category_id, [...existing, item]);
      }
    }
    return map;
  }, [items, effectiveBrandId, filteredCategories]);

  const isLoading = brandsLoading || categoriesLoading || itemsLoading;
  const hasError = brandsError || categoriesError || itemsError;

  const handleRetry = () => {
    if (brandsError) void refetchBrands();
    if (categoriesError) void refetchCategories();
    if (itemsError) void refetchItems();
  };

  return (
    <BlurFade direction="up">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold mb-8">Our Menu</h1>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-10 w-64 rounded-lg" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {!isLoading && hasError && (
          <div className="py-16 text-center space-y-4">
            <p className="text-base text-muted-foreground">
              Can&apos;t load the menu right now.
            </p>
            <Button variant="outline" onClick={handleRetry}>
              Try again
            </Button>
          </div>
        )}

        {/* No brands / empty state */}
        {!isLoading && !hasError && brands.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <UtensilsCrossed className="size-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">Menu Coming Soon</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Our menu is being prepared. Check back shortly to see what we have to offer.
            </p>
          </div>
        )}

        {/* Menu content */}
        {!isLoading && !hasError && brands.length > 0 && (
          <div className="space-y-8">
            <MenuBrandTabs
              brands={brands}
              activeBrandId={effectiveBrandId}
              onBrandChange={(id) => setActiveBrandId(id)}
            />

            {filteredCategories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <UtensilsCrossed className="size-12 text-muted-foreground/30" />
                <h2 className="text-lg font-semibold">Menu Coming Soon</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  This brand&apos;s menu is being updated. Check back shortly for new dishes.
                </p>
              </div>
            )}

            {filteredCategories.map((category) => {
              const categoryItems = itemsByCategory.get(category.id) ?? [];
              if (categoryItems.length === 0) return null;
              return (
                <div key={category.id} className="space-y-4">
                  <h2 className="text-xl font-semibold">
                    {category.name}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryItems.map((item) => (
                      <MenuItemPublicCard
                        key={item.id}
                        item={item}
                        available={
                          availability[item.id]?.available ?? item.available
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BlurFade>
  );
}
