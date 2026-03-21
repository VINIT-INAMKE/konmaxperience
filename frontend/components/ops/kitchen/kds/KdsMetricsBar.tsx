'use client';

import { useQuery } from '@tanstack/react-query';
import { NumberTicker } from '@/components/ui/number-ticker';
import { apiClient } from '@/lib/api-client';
import type { KitchenMetrics } from '@/lib/types/kds';

function wasteColor(pct: number): string {
  if (pct < 5) return 'text-[oklch(0.627_0.194_142.495)]';
  if (pct <= 10) return 'text-[oklch(0.769_0.188_70.08)]';
  return 'text-destructive';
}

export function KdsMetricsBar() {
  const { data: metrics } = useQuery({
    queryKey: ['kitchen-metrics'],
    queryFn: () => apiClient.get<KitchenMetrics>('/kitchen/metrics'),
    refetchInterval: 10000,
  });

  if (!metrics) return null;

  const waste_percentage = metrics.waste_percentage ?? 0;

  return (
    <div className="flex items-center gap-6 text-sm text-white/80">
      <div className="flex items-center gap-2">
        <span className="text-white/50">Orders:</span>
        <NumberTicker
          value={metrics.orders_in_queue}
          className="text-white font-semibold tabular-nums"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white/50">Completed Today:</span>
        <NumberTicker
          value={metrics.items_completed_today}
          className="text-white font-semibold tabular-nums"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white/50">Waste:</span>
        <span className={`font-semibold tabular-nums ${wasteColor(waste_percentage)}`}>
          {waste_percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
