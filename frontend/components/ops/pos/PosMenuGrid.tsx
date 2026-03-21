'use client';

import { useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PosMenuItemCard } from '@/components/ops/pos/PosMenuItemCard';
import type { Brand } from '@/lib/types/brand';
import type { MenuCategory, MenuItem } from '@/lib/types/menu';
import type { AvailabilityMap } from '@/lib/types/orders';

interface PosMenuGridProps {
  brands: Brand[];
  categories: MenuCategory[];
  items: MenuItem[];
  selectedBrandId: string;
  onBrandChange: (brandId: string) => void;
  availability: AvailabilityMap;
  onAddItem: (item: MenuItem) => void;
}

export function PosMenuGrid({
  brands,
  categories,
  items,
  selectedBrandId,
  onBrandChange,
  availability,
  onAddItem,
}: PosMenuGridProps) {
  // Group items by category_id
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      const existing = map.get(item.category_id) ?? [];
      map.set(item.category_id, [...existing, item]);
    }
    return map;
  }, [items]);

  // Items without a matching category
  const uncategorizedItems = useMemo(() => {
    const categoryIds = new Set(categories.map((c) => c.id));
    return items.filter((item) => !categoryIds.has(item.category_id));
  }, [items, categories]);

  return (
    <div className="space-y-4">
      {/* Brand tabs - sticky */}
      {brands.length > 0 && (
        <div className="sticky top-0 z-10 bg-background pb-2">
          <Tabs value={selectedBrandId} onValueChange={onBrandChange}>
            <TabsList className="flex-wrap h-auto gap-1">
              {brands.map((brand) => (
                <TabsTrigger key={brand.id} value={brand.id}>
                  <span className="text-[20px] font-bold leading-tight">
                    {brand.name}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Category sections */}
      {categories.length > 0 ? (
        categories.map((category) => {
          const categoryItems = itemsByCategory.get(category.id) ?? [];
          if (categoryItems.length === 0) return null;

          return (
            <div key={category.id} className="space-y-3">
              <h2 className="text-[20px] font-bold leading-tight">
                {category.name}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {categoryItems.map((item) => (
                  <PosMenuItemCard
                    key={item.id}
                    menuItem={item}
                    availability={availability[item.id]}
                    onAdd={() => onAddItem(item)}
                  />
                ))}
              </div>
            </div>
          );
        })
      ) : items.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-[20px] font-bold leading-tight">All Items</h2>
          <div className="grid grid-cols-3 gap-3">
            {items.map((item) => (
              <PosMenuItemCard
                key={item.id}
                menuItem={item}
                availability={availability[item.id]}
                onAdd={() => onAddItem(item)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Uncategorized items */}
      {uncategorizedItems.length > 0 && categories.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[20px] font-bold leading-tight">Other</h2>
          <div className="grid grid-cols-3 gap-3">
            {uncategorizedItems.map((item) => (
              <PosMenuItemCard
                key={item.id}
                menuItem={item}
                availability={availability[item.id]}
                onAdd={() => onAddItem(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="py-16 text-center space-y-2">
          <h2 className="text-base font-semibold">No menu items</h2>
          <p className="text-sm text-muted-foreground">
            Menu items for this brand will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
