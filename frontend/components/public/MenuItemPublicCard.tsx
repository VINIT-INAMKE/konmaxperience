'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { AvailabilityBadge } from '@/components/public/AvailabilityBadge';
import type { MenuItem } from '@/lib/types/menu';

interface MenuItemPublicCardProps {
  item: MenuItem;
  available: boolean;
}

export function MenuItemPublicCard({ item, available }: MenuItemPublicCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square bg-gray-100">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-4xl font-semibold text-gray-300">
              {item.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <CardContent className="space-y-2">
        <h4 className="text-base font-semibold text-gray-900">{item.name}</h4>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Rs. {item.base_price}</span>
          <AvailabilityBadge available={available} />
        </div>
      </CardContent>
    </Card>
  );
}
