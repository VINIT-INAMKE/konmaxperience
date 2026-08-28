'use client';

import { format } from 'date-fns';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UsageDailyPoint } from '@/lib/types/usage';
import { formatCount, formatDayKey } from './usage-labels';

interface UsageTrendChartProps {
  data: UsageDailyPoint[];
  /** How many x-axis labels to draw; the rest are skipped so 90 days stay legible. */
  maxTicks?: number;
}

/**
 * Page views per node-local day.
 *
 * The server guarantees the series is **dense** — exactly `days` entries with a
 * quiet day present as `0` — so there is no gap-filling here and a flat run of
 * zeroes is a true reading, not a hole in the data.
 */
export function UsageTrendChart({ data, maxTicks = 8 }: UsageTrendChartProps) {
  const interval = Math.max(0, Math.ceil(data.length / maxTicks) - 1);
  const isEmpty = data.length === 0 || data.every((point) => point.count === 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-ink-strong">Page views per day</CardTitle>
        <CardDescription>
          Node-local calendar days. A day with no traffic is a real zero, not a
          missing reading.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            No page views recorded yet for this window.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="usage-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-line" vertical={false} />
              <XAxis
                dataKey="date"
                interval={interval}
                tick={{ fontSize: 12 }}
                tickFormatter={(value: string) => format(new Date(`${value}T00:00:00`), 'd MMM')}
              />
              <YAxis allowDecimals={false} width={40} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [formatCount(Number(value)), 'Page views']}
                labelFormatter={(label) => formatDayKey(String(label))}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#usage-trend-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
