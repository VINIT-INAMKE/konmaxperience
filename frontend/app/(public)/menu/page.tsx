'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BlurFade } from '@/components/ui/blur-fade';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuBrandTabs } from '@/components/public/MenuBrandTabs';
import { MenuItemPublicCard } from '@/components/public/MenuItemPublicCard';
import { apiClient } from '@/lib/api-client';
import type { MenuCategory, MenuItem } from '@/lib/types/menu';

interface AvailabilityMap {
  [itemId: string]: { available: boolean; servings_remaining: number };
}

export default function MenuPage() {
  const [activeBrandId, setActiveBrandId] = useState<string>('');

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['public-brands'],
    queryFn: () =>
      apiClient.get<{ id: string; name: string }[]>('/brands'),
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['public-menu-categories'],
    queryFn: () => apiClient.get<MenuCategory[]>('/menu/categories'),
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
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

        {/* No brands / empty state */}
        {!isLoading && brands.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <p className="text-base text-gray-500">
              Menu is being updated. Check back shortly.
            </p>
          </div>
        )}

        {/* Menu content */}
        {!isLoading && brands.length > 0 && (
          <div className="space-y-8">
            <MenuBrandTabs
              brands={brands}
              activeBrandId={effectiveBrandId}
              onBrandChange={(id) => setActiveBrandId(id)}
            />

            {filteredCategories.length === 0 && (
              <div className="py-16 text-center space-y-2">
                <p className="text-base text-gray-500">
                  Menu is being updated. Check back shortly.
                </p>
              </div>
            )}

            {filteredCategories.map((category) => {
              const categoryItems = itemsByCategory.get(category.id) ?? [];
              if (categoryItems.length === 0) return null;
              return (
                <div key={category.id} className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">
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
