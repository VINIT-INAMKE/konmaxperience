'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UsageRoleBucket } from '@/lib/types/usage';
import {
  USAGE_CHART_COLORS,
  formatCount,
  isCustomerRole,
  usageRoleLabel,
} from './usage-labels';

interface UsageByRoleChartProps {
  data: UsageRoleBucket[];
}

const ROW_HEIGHT = 34;
const CHART_PADDING = 32;

/**
 * Events per role, busiest first, as a horizontal bar per role.
 *
 * The bucket counts **every** event — page views and actions together — and
 * includes the synthetic `CUSTOMER` role, which is the only place anonymous
 * storefront traffic surfaces. The per-user table below deliberately excludes
 * it, so the two totals will not agree; the card says so rather than leaving a
 * reader to discover the gap.
 */
export function UsageByRoleChart({ data }: UsageByRoleChartProps) {
  const rows = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.count - a.count)
        .map((bucket) => ({
          roleCode: bucket.role_code,
          label: usageRoleLabel(bucket.role_code),
          count: bucket.count,
          customer: isCustomerRole(bucket.role_code),
        })),
    [data],
  );

  const hasCustomerRow = rows.some((row) => row.customer);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-ink-strong">Events by role</CardTitle>
        <CardDescription>
          Page views and actions together, attributed to the role held when the
          event was recorded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            No activity recorded yet for this window.
          </p>
        ) : (
          <>
            <ResponsiveContainer
              width="100%"
              height={rows.length * ROW_HEIGHT + CHART_PADDING}
            >
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-line" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--surface-raised)' }}
                  formatter={(value) => [formatCount(Number(value)), 'Events']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {rows.map((row, index) => (
                    <Cell
                      key={row.roleCode}
                      fill={USAGE_CHART_COLORS[index % USAGE_CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {hasCustomerRow && (
              <p className="mt-2 text-xs text-ink-muted">
                &ldquo;Storefront visitors&rdquo; is anonymous shop traffic — it has
                no user behind it and never appears in the per-person table.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
