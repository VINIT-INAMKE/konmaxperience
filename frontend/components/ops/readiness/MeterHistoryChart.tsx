'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { METER_TONE_VAR, meterTone } from './meter-tone';
import type { MeterHistoryResponse } from '@/lib/types/readiness';

const RANGES = ['30', '90'] as const;

function safeFormat(date: string, pattern: string): string {
  try {
    return format(parseISO(date), pattern);
  } catch {
    return date;
  }
}

interface MeterHistoryChartProps {
  code: string;
  days?: number;
}

/**
 * SPEC §6.5 — the daily `ReadinessSnapshot` trail behind a meter. The Y axis is
 * pinned to 0-100 so a stable meter reads as stable rather than volatile, and the
 * dashed reference line is the meter's target.
 */
export function MeterHistoryChart({ code, days = 90 }: MeterHistoryChartProps) {
  const [range, setRange] = useState<string>(String(days));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['readiness-history', code, range],
    queryFn: () =>
      apiClient.get<MeterHistoryResponse>(
        `/readiness-meters/${code}/history?days=${range}`,
      ),
  });

  const points = data?.points ?? [];
  const tone = meterTone(data?.current_value ?? 0);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">History</CardTitle>
          <p className="mt-0.5 text-xs text-ink-muted">
            One snapshot per day, newest on the right
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(String(v))}>
          <TabsList aria-label="History range">
            {RANGES.map((r) => (
              <TabsTrigger key={r} value={r} className="px-2.5">
                {r}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {isLoading && <Skeleton className="h-56 w-full rounded-lg" />}

        {isError && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                Couldn&apos;t load history for this meter.
              </AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && points.length < 2 && (
          <div className="flex h-56 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-ink">No history yet</p>
            <p className="max-w-xs text-xs text-ink-muted">
              The first snapshot is written tonight. After that this chart fills
              in one point per day.
            </p>
          </div>
        )}

        {!isLoading && !isError && points.length >= 2 && (
          <ResponsiveContainer width="100%" height={224}>
            <LineChart
              data={points}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => safeFormat(d, 'MMM d')}
                tick={{ fontSize: 11 }}
                minTickGap={24}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}`}
                tick={{ fontSize: 11 }}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: 'var(--line-strong)' }}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--ink)',
                  fontSize: 12,
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Readiness']}
                labelFormatter={(label) =>
                  safeFormat(String(label), 'MMM d, yyyy')
                }
              />
              {data ? (
                <ReferenceLine
                  y={data.target_value}
                  stroke="var(--ink-faint)"
                  strokeDasharray="4 4"
                  label={{
                    value: `target ${Math.round(data.target_value)}`,
                    position: 'insideTopRight',
                    fill: 'var(--ink-faint)',
                    fontSize: 10,
                  }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="value"
                stroke={METER_TONE_VAR[tone]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
