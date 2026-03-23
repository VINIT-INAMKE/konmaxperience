'use client';

import Image from 'next/image';
import { MagicCard } from '@/components/ui/magic-card';
import { AvailabilityBadge } from '@/components/public/AvailabilityBadge';
import type { MenuItem } from '@/lib/types/menu';

interface MenuItemPublicCardProps {
  item: MenuItem;
  available: boolean;
}

export function MenuItemPublicCard({ item, available }: MenuItemPublicCardProps) {
  return (
    <MagicCard className="rounded-xl overflow-hidden">
      <div className="relative aspect-square bg-muted">
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
            <span className="text-4xl font-semibold text-muted-foreground/40">
              {item.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h4 className="text-base font-semibold text-foreground truncate">{item.name}</h4>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">₹{item.base_price}</span>
          <AvailabilityBadge available={available} />
        </div>
      </div>
    </MagicCard>
  );
}
