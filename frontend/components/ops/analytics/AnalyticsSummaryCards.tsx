'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { IndianRupee, Percent, ShoppingCart, TrendingUp } from 'lucide-react';
import type { AnalyticsSummary } from '@/lib/types/analytics';

interface AnalyticsSummaryCardsProps {
  summary?: AnalyticsSummary;
  isLoading: boolean;
}

const secondaryCards = [
  { key: 'food_cost', label: 'Avg Food Cost', icon: Percent, field: 'avg_food_cost_pct' as const, suffix: '%' },
  { key: 'orders', label: 'Total Orders', icon: ShoppingCart, field: 'total_orders' as const },
  { key: 'aov', label: 'Avg Order Value', icon: TrendingUp, field: 'avg_order_value' as const, prefix: '₹' },
] as const;

export function AnalyticsSummaryCards({ summary, isLoading }: AnalyticsSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="col-span-2 lg:col-span-2 border-l-4 border-l-gold/30">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-28" />
          </CardContent>
        </Card>
        {[1, 2, 3].map((i) => (
          <Card key={i} className={i === 3 ? 'col-span-2 lg:col-span-1' : ''}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const revenueValue = Math.round(summary.total_revenue);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Hero: Total Revenue */}
      <Card className="col-span-2 lg:col-span-2 border-l-4 border-l-gold/30">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-ink-muted uppercase tracking-wide">Total Revenue</span>
            <IndianRupee className="size-5 text-gold" />
          </div>
          <p className="mt-3 text-4xl font-bold leading-tight tabular-nums">
            ₹{revenueValue.toLocaleString('en-IN')}
          </p>
        </CardContent>
      </Card>

      {/* Secondary metric cards */}
      {secondaryCards.map((card) => {
        const Icon = card.icon;
        const value = Math.round(summary[card.field]);

        return (
          <Card key={card.key} className={card.key === 'aov' ? 'col-span-2 lg:col-span-1' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-ink-muted">{card.label}</span>
                <Icon className="size-4 text-ink-muted" />
              </div>
              <p className="mt-2 text-[28px] font-bold font-mono leading-tight tabular-nums">
                {'prefix' in card && card.prefix}
                {value.toLocaleString('en-IN')}
                {'suffix' in card && <span className="text-sm font-normal ml-1">{card.suffix}</span>}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
