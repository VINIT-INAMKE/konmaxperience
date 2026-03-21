'use client';

import { Card, CardContent } from '@/components/ui/card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart, CheckCircle, Clock, Trash2 } from 'lucide-react';
import type { KitchenMetrics } from '@/lib/types/analytics';

interface KitchenMetricsCardsProps {
  metrics?: KitchenMetrics;
  isLoading: boolean;
}

const cards = [
  { key: 'queue', label: 'In Queue', icon: ShoppingCart, field: 'orders_in_queue' as const },
  { key: 'completed', label: 'Completed Today', icon: CheckCircle, field: 'items_completed_today' as const },
  { key: 'prep', label: 'Avg Prep Time', icon: Clock, field: 'average_prep_time_minutes' as const, suffix: 'min' },
  { key: 'waste', label: 'Waste Today', icon: Trash2, field: 'waste_today_cost' as const, prefix: '₹' },
] as const;

export function KitchenMetricsCards({ metrics, isLoading }: KitchenMetricsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const raw = metrics[card.field];
        const value = typeof raw === 'number' ? raw : 0;

        return (
          <Card key={card.key}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-muted-foreground">{card.label}</span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-[28px] font-bold font-mono leading-tight">
                {'prefix' in card && card.prefix}
                <NumberTicker value={Math.round(value)} />
                {'suffix' in card && <span className="text-sm font-normal ml-1">{card.suffix}</span>}
              </p>
              {card.field === 'waste_today_cost' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.waste_percentage.toFixed(1)}% of production
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
