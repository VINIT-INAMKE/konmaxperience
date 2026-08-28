'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  Eye,
  MousePointerClick,
  Route,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import {
  USAGE_RANGE_DAYS,
  type UsageRangeDays,
  type UsageSummary,
} from '@/lib/types/usage';
import { UsageBucketList, type UsageBucketRow } from './UsageBucketList';
import { UsageByRoleChart } from './UsageByRoleChart';
import { UsageLastSeenTable } from './UsageLastSeenTable';
import { UsageTrendChart } from './UsageTrendChart';
import { formatCount, formatDayKey, usageActionLabel } from './usage-labels';

const DEFAULT_RANGE: UsageRangeDays = 30;

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  icon: typeof Eye;
  /** Renders the value at body size — a path is prose, not a figure. */
  small?: boolean;
}

function KpiCard({ label, value, hint, icon: Icon, small }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-bold tracking-wide text-ink-muted uppercase">
            {label}
          </span>
          <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
        </div>
        <p
          className={
            small
              ? 'mt-2 truncate font-mono text-base leading-tight font-bold text-ink-strong'
              : 'mt-2 font-mono text-[28px] leading-tight font-bold tabular-nums text-ink-strong'
          }
          title={small ? value : undefined}
        >
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-ink-muted">{hint}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[104px] animate-pulse rounded-xl bg-surface-raised motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-[300px] animate-pulse rounded-xl bg-surface-raised motion-reduce:animate-none" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[320px] animate-pulse rounded-xl bg-surface-raised motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-[280px] animate-pulse rounded-xl bg-surface-raised motion-reduce:animate-none" />
    </div>
  );
}

/**
 * RUN-04's roll-up over `UsageEvent`.
 *
 * Three facts drive the shape of this screen:
 *
 * 1. **`daily` is dense.** The server returns exactly `days` entries with quiet
 *    days zero-filled, so the trend needs no gap-filling and a flat line is a
 *    true reading.
 * 2. **`by_role` and `by_user` count different populations.** `by_role` includes
 *    the synthetic `CUSTOMER` role (anonymous storefront traffic, no `user_id`);
 *    `by_user` is staff only. The copy on both cards says so, because otherwise
 *    the two totals look like a bug.
 * 3. **Empty is the normal state on a fresh install.** No events means an
 *    explicit "nothing recorded yet" panel, never an axis drawn over no data.
 */
export function UsageDashboard() {
  const [range, setRange] = useState<UsageRangeDays>(DEFAULT_RANGE);
  // Pinned once so every relative "last seen" in the table agrees with the others.
  const [now] = useState(() => Date.now());

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['usage-summary', range],
    queryFn: () => apiClient.get<UsageSummary>(`/usage/summary?days=${range}`),
  });

  const totals = useMemo(() => {
    if (!data) return null;
    const events = data.by_role.reduce((sum, bucket) => sum + bucket.count, 0);
    const pageViews = data.daily.reduce((sum, point) => sum + point.count, 0);
    return {
      events,
      pageViews,
      // `by_action` is capped at 25 buckets, so it cannot be summed for a total.
      // `by_role` covers every event in the window, which makes this exact.
      actions: Math.max(0, events - pageViews),
      activeStaff: data.by_user.length,
      busiest: data.by_path[0] ?? null,
    };
  }, [data]);

  const pathRows: UsageBucketRow[] = useMemo(
    () =>
      (data?.by_path ?? []).map((bucket) => ({
        id: bucket.path,
        label: bucket.path,
        count: bucket.count,
        href: bucket.path.startsWith('/') ? bucket.path : undefined,
      })),
    [data],
  );

  const actionRows: UsageBucketRow[] = useMemo(
    () =>
      (data?.by_action ?? []).map((bucket) => ({
        id: bucket.action,
        label: usageActionLabel(bucket.action),
        hint: bucket.action,
        count: bucket.count,
      })),
    [data],
  );

  const rangeSelector = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2" role="group" aria-label="Window length">
        {USAGE_RANGE_DAYS.map((days) => (
          <Button
            key={days}
            size="sm"
            variant={range === days ? 'default' : 'outline'}
            aria-pressed={range === days}
            onClick={() => setRange(days)}
          >
            {days} days
          </Button>
        ))}
      </div>
      {data && (
        <p className="text-xs text-ink-muted">
          {formatDayKey(data.from)} — {formatDayKey(data.to)}
          <span className="text-ink-faint"> · node-local days, both ends included</span>
        </p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {rangeSelector}
        <DashboardSkeleton />
      </div>
    );
  }

  if (isError || !data || !totals) {
    return (
      <div className="space-y-4">
        {rangeSelector}
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-card py-12 text-center ring-1 ring-foreground/10">
          <AlertCircle className="size-8 text-serious" aria-hidden="true" />
          <p className="text-sm text-ink-muted">
            {error instanceof Error && error.message
              ? error.message
              : "Can't load the usage roll-up right now."}
          </p>
          <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? 'Retrying…' : 'Try again'}
          </Button>
        </div>
      </div>
    );
  }

  if (totals.events === 0) {
    return (
      <div className="space-y-4">
        {rangeSelector}
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-card py-16 text-center ring-1 ring-foreground/10">
          <Activity className="size-8 text-ink-faint" aria-hidden="true" />
          <p className="text-sm font-medium text-ink-strong">No activity recorded yet</p>
          <p className="max-w-md text-sm text-ink-muted">
            Nothing was logged between {formatDayKey(data.from)} and{' '}
            {formatDayKey(data.to)}. On a fresh install that is the
            expected reading — page views and key actions appear here as soon as
            somebody uses the app.
          </p>
          <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rangeSelector}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Page views"
          value={formatCount(totals.pageViews)}
          hint={`over ${data.days} days`}
          icon={Eye}
        />
        <KpiCard
          label="Key actions"
          value={formatCount(totals.actions)}
          hint={`of ${formatCount(totals.events)} events in total`}
          icon={MousePointerClick}
        />
        <KpiCard
          label="Active staff"
          value={formatCount(totals.activeStaff)}
          hint="people with at least one event"
          icon={Users}
        />
        <KpiCard
          label="Busiest screen"
          value={totals.busiest ? totals.busiest.path : '—'}
          hint={
            totals.busiest
              ? `${formatCount(totals.busiest.count)} page views`
              : 'no page views in this window'
          }
          icon={Route}
          small
        />
      </div>

      <UsageTrendChart data={data.daily} />

      <div className="grid gap-4 lg:grid-cols-3">
        <UsageByRoleChart data={data.by_role} />
        <UsageBucketList
          title="Busiest screens"
          description="Page views only, busiest first. The server returns at most 25."
          rows={pathRows}
          emptyLabel="No page views recorded yet for this window."
          unit="page views"
        />
        <UsageBucketList
          title="Key actions"
          description="The instrumented action vocabulary, busiest first. At most 25."
          rows={actionRows}
          emptyLabel="No key actions recorded yet for this window."
          unit="times"
        />
      </div>

      <UsageLastSeenTable rows={data.by_user} now={now} />
    </div>
  );
}
