'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalyticsSummaryCards } from '@/components/ops/analytics/AnalyticsSummaryCards';

const RevenueTrendChart = dynamic(
  () => import('@/components/ops/analytics/RevenueTrendChart').then((m) => m.RevenueTrendChart),
  { loading: () => <Skeleton className="h-72 rounded-xl" /> },
);
const TopItemsList = dynamic(
  () => import('@/components/ops/analytics/TopItemsList').then((m) => m.TopItemsList),
  { loading: () => <Skeleton className="h-72 rounded-xl" /> },
);
const ChannelBreakdownChart = dynamic(
  () => import('@/components/ops/analytics/ChannelBreakdownChart').then((m) => m.ChannelBreakdownChart),
  { loading: () => <Skeleton className="h-72 rounded-xl" /> },
);
const RecipeCostTable = dynamic(
  () => import('@/components/ops/analytics/RecipeCostTable').then((m) => m.RecipeCostTable),
  { loading: () => <Skeleton className="h-72 rounded-xl" /> },
);
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type {
  AnalyticsSummary,
  RevenuePoint,
  TopItem,
  ChannelRevenue,
  RecipeCostRow,
} from '@/lib/types/analytics';
import { AlertCircle, Scale, ShieldAlert } from 'lucide-react';
import { ExportButton } from '@/components/ops/exports/ExportButton';

type TimeRange = 'today' | '7d' | '30d' | 'custom';

function computeDateRange(
  timeRange: TimeRange,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  let from: string;
  let to: string = today;

  if (timeRange === 'today') {
    from = today;
  } else if (timeRange === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    from = d.toISOString().split('T')[0];
  } else if (timeRange === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    from = d.toISOString().split('T')[0];
  } else {
    from = customFrom;
    to = customTo;
  }

  return { from, to };
}

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const queryClient = useQueryClient();

  const isAuthorized =
    permissions.includes('MANAGE_KPIS') ||
    user?.roleCode === RoleCode.FOUNDER_ADMIN ||
    user?.roleCode === ('BI_LEAD' as RoleCode);

  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState(() =>
    new Date().toISOString().split('T')[0],
  );

  const { from, to } = computeDateRange(timeRange, customFrom, customTo);

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ['analytics', 'summary', from, to],
    queryFn: () => apiClient.get<AnalyticsSummary>(`/analytics/summary?from=${from}&to=${to}`),
    enabled: isAuthorized,
  });

  const { data: revenue, isLoading: revenueLoading, isError: revenueError } = useQuery({
    queryKey: ['analytics', 'revenue', from, to],
    queryFn: () => apiClient.get<RevenuePoint[]>(`/analytics/revenue?from=${from}&to=${to}`),
    enabled: isAuthorized,
  });

  const { data: topItems, isError: topItemsError } = useQuery({
    queryKey: ['analytics', 'top-items', from, to],
    queryFn: () => apiClient.get<TopItem[]>(`/analytics/top-items?from=${from}&to=${to}`),
    enabled: isAuthorized,
  });

  const { data: channels, isError: channelsError } = useQuery({
    queryKey: ['analytics', 'channels', from, to],
    queryFn: () => apiClient.get<ChannelRevenue[]>(`/analytics/channels?from=${from}&to=${to}`),
    enabled: isAuthorized,
  });

  const { data: recipeCosts, isError: recipeCostsError } = useQuery({
    queryKey: ['analytics', 'recipe-costs', from, to],
    queryFn: () => apiClient.get<RecipeCostRow[]>(`/analytics/recipe-costs?from=${from}&to=${to}`),
    enabled: isAuthorized,
  });

  const hasError =
    summaryError ||
    revenueError ||
    topItemsError ||
    channelsError ||
    recipeCostsError;

  const retryAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  if (!isAuthorized) {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center space-y-4">
              <ShieldAlert className="size-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Access restricted. BI analytics requires the Analytics permission.
              </p>
            </CardContent>
          </Card>
        </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {/* Header: title + time range toggle */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <div className="flex flex-wrap items-center gap-2">
            {/*
              RUN-03's entry point. `/intelligence/food-cost` deliberately has no
              spine item (P6 decision 20) — it shares the `analytics` module key,
              and two entries under one key are indistinguishable in the modules
              editor — so this link is how it is reached.
            */}
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/intelligence/food-cost" />}
            >
              <Scale className="size-4" aria-hidden />
              Food Cost
            </Button>
            <ExportButton
              reportType="revenue_summary"
              reportName="Analytics"
              isTimeSeries={true}
              currentFilters={{ dateFrom: from, dateTo: to }}
            />
            {(['today', '7d', '30d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
              >
                {range === 'today' ? 'Today' : range === '7d' ? '7 days' : '30 days'}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger
                className={`inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
                  timeRange === 'custom'
                    ? 'bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                Custom
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold">From</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="mt-1 block w-full rounded-md border bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold">To</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="mt-1 block w-full rounded-md border bg-background px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setTimeRange('custom')}
                >
                  Apply Range
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Error state */}
        {hasError && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                Some analytics couldn&apos;t be loaded for this range. Figures below may be incomplete.
              </AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" onClick={retryAll}>
              Retry
            </Button>
          </div>
        )}

        {/* Summary cards */}
        <AnalyticsSummaryCards summary={summary} isLoading={summaryLoading} />

        {/* Revenue trend — full width */}
        <RevenueTrendChart data={revenue ?? []} isLoading={revenueLoading} />

        {/* Top items + Channel donut — 3/5 + 2/5 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <TopItemsList data={topItems ?? []} />
          </div>
          <div className="lg:col-span-2">
            <ChannelBreakdownChart data={channels ?? []} />
          </div>
        </div>

        {/* Recipe cost table — full width */}
        <RecipeCostTable data={recipeCosts ?? []} />
      </div>
    </>
  );
}
