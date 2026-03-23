'use client';

import { format } from 'date-fns';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { RevenuePoint } from '@/lib/types/analytics';

interface RevenueTrendChartProps {
  data: RevenuePoint[];
  isLoading: boolean;
}

export function RevenueTrendChart({ data, isLoading }: RevenueTrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold">Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-muted-foreground">No revenue data for this period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => format(new Date(d + 'T00:00:00'), 'MMM d')}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v}`
                }
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                labelFormatter={(label: any) =>
                  format(new Date(String(label) + 'T00:00:00'), 'MMM d, yyyy')
                }
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--chart-1)"
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
