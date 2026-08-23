'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { KitchenMetrics } from '@/lib/types/kds';

function wasteColor(pct: number): string {
  if (pct < 5) return 'text-good';
  if (pct <= 10) return 'text-warning';
  return 'text-critical';
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
    <div className="flex items-center gap-6 text-sm text-ink-subtle">
      <div className="flex items-center gap-2">
        <span className="text-ink-muted">Orders:</span>
        <span className="text-ink-strong font-semibold tabular-nums">
          {metrics.orders_in_queue.toLocaleString('en-US')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-ink-muted">Completed Today:</span>
        <span className="text-ink-strong font-semibold tabular-nums">
          {metrics.items_completed_today.toLocaleString('en-US')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-ink-muted">Waste:</span>
        <span className={`font-semibold tabular-nums ${wasteColor(waste_percentage)}`}>
          {waste_percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
