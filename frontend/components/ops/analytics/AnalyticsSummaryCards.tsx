'use client';

import { Card, CardContent } from '@/components/ui/card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { IndianRupee, Percent, ShoppingCart, TrendingUp } from 'lucide-react';
import type { AnalyticsSummary } from '@/lib/types/analytics';

interface AnalyticsSummaryCardsProps {
  summary?: AnalyticsSummary;
  isLoading: boolean;
}

const cards = [
  { key: 'revenue', label: 'Total Revenue', icon: IndianRupee, field: 'total_revenue' as const, prefix: '₹' },
  { key: 'food_cost', label: 'Avg Food Cost', icon: Percent, field: 'avg_food_cost_pct' as const, suffix: '%' },
  { key: 'orders', label: 'Total Orders', icon: ShoppingCart, field: 'total_orders' as const },
  { key: 'aov', label: 'Avg Order Value', icon: TrendingUp, field: 'avg_order_value' as const, prefix: '₹' },
] as const;

export function AnalyticsSummaryCards({ summary, isLoading }: AnalyticsSummaryCardsProps) {
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

  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = Math.round(summary[card.field]);

        return (
          <Card key={card.key}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-muted-foreground">{card.label}</span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-[28px] font-bold font-mono leading-tight">
                {'prefix' in card && card.prefix}
                <NumberTicker value={value} />
                {'suffix' in card && <span className="text-sm font-normal ml-1">{card.suffix}</span>}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
