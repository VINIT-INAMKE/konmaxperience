'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChannelRevenue } from '@/lib/types/analytics';

interface ChannelBreakdownChartProps {
  data: ChannelRevenue[];
}

const CHART_COLORS = [
  'var(--chart-1))',
  'var(--chart-2))',
  'var(--chart-3))',
  'var(--chart-4))',
  'var(--chart-5))',
];

function formatChannel(channel: string): string {
  return channel
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ChannelBreakdownChart({ data }: ChannelBreakdownChartProps) {
  const formatted = data.map((d) => ({ ...d, channel: formatChannel(d.channel) }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold">Revenue by Channel</CardTitle>
      </CardHeader>
      <CardContent>
        {formatted.length === 0 ? (
          <div className="flex items-center justify-center h-60">
            <p className="text-sm text-muted-foreground">No channel data for this period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={formatted}
                dataKey="revenue"
                nameKey="channel"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                isAnimationActive={false}
              >
                {formatted.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
