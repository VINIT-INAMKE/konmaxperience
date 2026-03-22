'use client';

import Link from 'next/link';
import { MagicCard } from '@/components/ui/magic-card';
import { Badge } from '@/components/ui/badge';
import type { IngredientStock } from '@/lib/types/inventory';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

interface DashboardLowStockAlertProps {
  lowStockItems: IngredientStock[];
}

export function DashboardLowStockAlert({ lowStockItems }: DashboardLowStockAlertProps) {
  if (lowStockItems.length === 0) {
    return null;
  }

  // Show max 4 cards
  const displayItems = lowStockItems.slice(0, 4);

  return (
    <div className="space-y-3">
      <span className="text-sm font-semibold">Low Stock Alerts</span>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayItems.map((item) => (
          <MagicCard key={item.id} gradientColor={GRADIENT_OVERLAY} className="rounded-xl">
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium leading-tight">{item.ingredient?.name}</p>
                  <p className="text-xs text-muted-foreground">{item.zone?.name}</p>
                </div>
                <Badge className="text-xs border-0 bg-amber-500/15 text-amber-500">Low Stock</Badge>
              </div>
              <p className="font-mono text-sm text-amber-500">
                {item.current_quantity} / {item.ingredient?.min_stock_level} {item.ingredient?.base_unit}
              </p>
            </div>
          </MagicCard>
        ))}
      </div>
      <div className="flex justify-end">
        <Link
          href="/operations/inventory"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View Inventory
        </Link>
      </div>
    </div>
  );
}
