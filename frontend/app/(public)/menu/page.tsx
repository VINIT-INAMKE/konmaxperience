'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UtensilsCrossed } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MenuBrandTabs } from '@/components/public/MenuBrandTabs';
import { CategoryTabBar } from '@/components/public/CategoryTabBar';
import { ProductOrderCard } from '@/components/public/ProductOrderCard';
import { apiClient } from '@/lib/api-client';
import type { ProductCategory, Product } from '@/lib/types/catalog';

interface AvailabilityMap {
  [itemId: string]: { available: boolean; servings_remaining: number };
}

export default function MenuPage() {
  const [activeBrandId, setActiveBrandId] = useState<string>('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const sectionRefs = useRef<Map<string, IntersectionObserverEntry>>(new Map());

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
    queryFn: () => apiClient.get<ProductCategory[]>('/catalog/categories'),
  });

  const {
    data: items = [],
    isLoading: itemsLoading,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['public-menu-items'],
    queryFn: () =>
      apiClient
        .get<{ items: Product[]; next_cursor: string | null }>(
          '/catalog/products?limit=200',
        )
        .then((r) => r.items),
  });

  const { data: availability = {} } = useQuery({
    queryKey: ['public-menu-availability'],
    queryFn: () =>
      apiClient.get<AvailabilityMap>('/catalog/availability'),
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
    [categories, effectiveBrandId],
  );

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
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

  // Set initial active category
  useEffect(() => {
    if (filteredCategories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, activeCategoryId]);

  // Reset active category when brand changes
  useEffect(() => {
    if (filteredCategories.length > 0) {
      setActiveCategoryId(filteredCategories[0].id);
    }
  }, [effectiveBrandId, filteredCategories]);

  // IntersectionObserver for scroll-spy on category sections
  useEffect(() => {
    if (filteredCategories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          sectionRefs.current.set(entry.target.id, entry);
        }
        // Find the topmost visible section
        let topSectionId = '';
        let topY = Infinity;
        sectionRefs.current.forEach((entry, id) => {
          if (entry.isIntersecting && entry.boundingClientRect.top < topY) {
            topY = entry.boundingClientRect.top;
            topSectionId = id;
          }
        });
        if (topSectionId) {
          const catId = topSectionId.replace('category-', '');
          setActiveCategoryId(catId);
        }
      },
      {
        rootMargin: '-120px 0px -60% 0px',
        threshold: 0,
      },
    );

    for (const cat of filteredCategories) {
      const el = document.getElementById(`category-${cat.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [filteredCategories]);

  const handleCategoryClick = useCallback((id: string) => {
    setActiveCategoryId(id);
  }, []);

  const isLoading = brandsLoading || categoriesLoading || itemsLoading;
  const hasError = brandsError || categoriesError || itemsError;

  const handleRetry = () => {
    if (brandsError) void refetchBrands();
    if (categoriesError) void refetchCategories();
    if (itemsError) void refetchItems();
  };

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8 pb-16">
        <h1 className="text-3xl font-semibold mb-6 text-[var(--public-fg)]">Our Menu</h1>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            {/* Tab skeletons */}
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-full" />
              ))}
            </div>
            {/* Card skeletons */}
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {!isLoading && hasError && (
          <div className="py-16 text-center space-y-4">
            <p className="text-base text-[var(--public-muted)]">
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
            <UtensilsCrossed className="size-12 text-[var(--public-muted)]/30" />
            <h2 className="text-lg font-semibold text-[var(--public-fg)]">Menu Coming Soon</h2>
            <p className="text-sm text-[var(--public-muted)] max-w-md">
              Our menu is being prepared. Check back shortly.
            </p>
          </div>
        )}

        {/* Menu content */}
        {!isLoading && !hasError && brands.length > 0 && (
          <div className="space-y-2">
            {/* Brand tabs (only show if multiple brands) */}
            {brands.length > 1 && (
              <div className="mb-4">
                <MenuBrandTabs
                  brands={brands}
                  activeBrandId={effectiveBrandId}
                  onBrandChange={(id) => setActiveBrandId(id)}
                />
              </div>
            )}

            {/* Category tab bar */}
            <CategoryTabBar
              categories={filteredCategories}
              activeCategoryId={activeCategoryId}
              onCategoryClick={handleCategoryClick}
            />

            {filteredCategories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <UtensilsCrossed className="size-12 text-[var(--public-muted)]/30" />
                <h2 className="text-lg font-semibold text-[var(--public-fg)]">Menu Coming Soon</h2>
                <p className="text-sm text-[var(--public-muted)] max-w-md">
                  Our menu is being prepared. Check back shortly.
                </p>
              </div>
            )}

            {/* Category sections with items */}
            <div className="pt-4 space-y-6">
              {filteredCategories.map((category) => {
                const categoryItems = itemsByCategory.get(category.id) ?? [];
                if (categoryItems.length === 0) return null;
                return (
                  <div
                    key={category.id}
                    id={`category-${category.id}`}
                    className="scroll-mt-28"
                  >
                    <h2 className="text-xl font-semibold text-[var(--public-fg)] mb-3">
                      {category.name}
                    </h2>
                    <div className="flex flex-col gap-2">
                      {categoryItems.map((item) => (
                        <ProductOrderCard
                          key={item.id}
                          item={item}
                          available={
                            availability[item.id]?.available ??
                            item.status === 'active'
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/*
        The phone-shaped floating cart bar and its bottom sheet were deleted with
        the v2 cart (P5b Task 8). The cart now lives in the storefront header's
        mini-cart, and this route redirects to `/shop?type=prepared_food` once
        Task 13 lands.
      */}
    </>
  );
}
