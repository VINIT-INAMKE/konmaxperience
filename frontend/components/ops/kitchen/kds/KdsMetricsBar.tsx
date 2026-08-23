'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { KitchenMetrics } from '@/lib/types/kds';
import {
  POLL_FLOOR_MS,
  useRealtimeChannel,
} from '@/lib/hooks/use-realtime-channel';

const METRICS_QUERY_KEY = ['kitchen-metrics'] as const;
/** Same channel as `KdsBoard` — `acquireChannel` reference-counts the socket. */
const KDS_EVENTS = ['kds.order.new', 'kds.order.updated'] as const;
const METRICS_INVALIDATE = [METRICS_QUERY_KEY] as const;

function wasteColor(pct: number): string {
  if (pct < 5) return 'text-good';
  if (pct <= 10) return 'text-warning';
  return 'text-critical';
}

export function KdsMetricsBar() {
  const { live } = useRealtimeChannel(
    'private-kds',
    KDS_EVENTS,
    METRICS_INVALIDATE,
  );

  const { data: metrics } = useQuery({
    queryKey: METRICS_QUERY_KEY,
    queryFn: () => apiClient.get<KitchenMetrics>('/kitchen/metrics'),
    refetchInterval: live ? false : POLL_FLOOR_MS,
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
