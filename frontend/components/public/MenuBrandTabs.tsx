'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MenuBrandTabsProps {
  brands: { id: string; name: string }[];
  activeBrandId: string;
  onBrandChange: (id: string) => void;
}

export function MenuBrandTabs({
  brands,
  activeBrandId,
  onBrandChange,
}: MenuBrandTabsProps) {
  return (
    <Tabs value={activeBrandId} onValueChange={(v) => onBrandChange(v)}>
      <TabsList className="overflow-x-auto flex-nowrap w-full justify-start">
        {brands.map((brand) => (
          <TabsTrigger key={brand.id} value={brand.id}>
            {brand.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
