'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { IngredientStock } from '@/lib/types/inventory';

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
          <Card key={item.id} className="py-0">
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium leading-tight">{item.ingredient?.name}</p>
                  <p className="text-xs text-muted-foreground">{item.zone?.name}</p>
                </div>
                <Badge className={`text-xs ${STATUS_BADGE.warning}`}>Low Stock</Badge>
              </div>
              <p className="font-mono text-sm text-[var(--status-warning)]">
                {item.current_quantity} / {item.ingredient?.min_stock_level} {item.ingredient?.base_unit}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Link
          href="/operations/inventory"
          className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        >
          View Inventory
        </Link>
      </div>
    </div>
  );
}
