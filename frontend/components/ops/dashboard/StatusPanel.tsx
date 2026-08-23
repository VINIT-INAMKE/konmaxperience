'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { IndianRupee, Soup } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MeterRing } from '@/components/ops/readiness/MeterRing';
import { MeterModeBadge } from '@/components/ops/readiness/MeterModeBadge';
import {
  METER_TONE_TEXT,
  METER_TONE_VAR,
  METER_TRACK_VAR,
  meterTone,
} from '@/components/ops/readiness/meter-tone';
import { MissionContextStrip } from './MissionContextStrip';
import { ActivityFeedWidget } from './ActivityFeedWidget';
import { TeamContributionWidget } from './TeamContributionWidget';
import { ReadinessSparkline } from './ReadinessSparkline';
import { apiClient } from '@/lib/api-client';
import { optionalGet } from '@/lib/api/optional';
import type { AnalyticsSummary } from '@/lib/types/analytics';
import type { OrderStatus } from '@/lib/types/kds';
import type { ReadinessMeter } from '@/lib/types/readiness';

/** How many meters the strip shows before "View all readiness" takes over. */
const METERS_SHOWN = 6;

/**
 * Statuses that mean "money is committed but the hand-over has not happened".
 * `served` / `delivered` / `completed` / `cancelled` / `refunded` are settled.
 */
const IN_FLIGHT: OrderStatus[] = [
  'placed',
  'confirmed',
  'preparing',
  'ready',
  'dispatched',
  'shipped',
];

interface OrderRow {
  id: string;
  status: OrderStatus;
}

/** `YYYY-MM-DD` for the browser's today — the analytics range is day-keyed. */
function todayKey(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function StatTile({
  icon: Icon,
  label,
  children,
  isLoading,
}: {
  icon: typeof IndianRupee;
  label: string;
  children: React.ReactNode;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-ink-muted ring-1 ring-[var(--line)]">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-6 w-24" />
          ) : (
            <p className="truncate text-xl font-semibold tabular-nums text-ink-strong">
              {children}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SPEC §6.5 "Status" — the active mission and its quest progress, the readiness
 * grid with a 30-day sparkline per meter, revenue today and orders in flight.
 *
 * Revenue and orders are gated on `MANAGE_KPIS` / `MANAGE_POS`; a Mission
 * Control viewer without them simply does not see those two tiles rather than
 * seeing an error.
 */
export function StatusPanel() {
  const day = todayKey();

  const meters = useQuery({
    queryKey: ['readiness-meters'],
    queryFn: () => apiClient.get<ReadinessMeter[]>('/readiness-meters'),
  });

  const revenue = useQuery({
    queryKey: ['analytics', 'summary', day, day],
    queryFn: () =>
      optionalGet<AnalyticsSummary>(
        `/analytics/summary?from=${day}&to=${day}`,
      ),
  });

  // The 100 most recent orders, counted client-side: `OrderFiltersDto.status`
  // takes one enum value, and six round-trips to count six statuses is worse
  // than one page of orders that already contains every unsettled one.
  const orders = useQuery({
    queryKey: ['orders', 'in-flight'],
    queryFn: () => optionalGet<OrderRow[]>('/orders?limit=100'),
    refetchInterval: 60_000,
  });

  const lowestMeters = [...(meters.data ?? [])]
    .sort((a, b) => a.current_value - b.current_value)
    .slice(0, METERS_SHOWN);

  const inFlight = (orders.data ?? []).filter((order) =>
    IN_FLIGHT.includes(order.status),
  ).length;

  // A tile is drawn only while its endpoint is still answering or has answered.
  // `optionalGet` turns "no permission" and "not deployed" into `null`, and a
  // tile with no data behind it is dropped rather than shown reading zero.
  const showRevenue = revenue.isLoading || Boolean(revenue.data);
  const showOrders = orders.isLoading || Boolean(orders.data);

  return (
    <div className="space-y-4">
      <MissionContextStrip />

      {(showRevenue || showOrders) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {showRevenue && (
            <StatTile
              icon={IndianRupee}
              label="Revenue today"
              isLoading={revenue.isLoading}
            >
              ₹
              {Math.round(revenue.data?.total_revenue ?? 0).toLocaleString(
                'en-IN',
              )}
            </StatTile>
          )}
          {showOrders && (
            <StatTile
              icon={Soup}
              label="Orders in flight"
              isLoading={orders.isLoading}
            >
              {inFlight}
            </StatTile>
          )}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">System readiness</h3>
            <Link
              href="/readiness"
              className="rounded-sm text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            >
              View all
            </Link>
          </div>

          {meters.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-12 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : lowestMeters.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No readiness meters are configured yet.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
              {lowestMeters.map((meter) => {
                const tone = meterTone(meter.current_value);
                return (
                  <li key={meter.id} className="flex items-center gap-3">
                    <div className="relative size-12 shrink-0">
                      <MeterRing
                        value={meter.current_value}
                        toneVar={METER_TONE_VAR[tone]}
                        trackVar={METER_TRACK_VAR}
                        strokeWidth={10}
                        label={`${meter.name}: ${Math.round(meter.current_value)} percent`}
                      />
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums ${METER_TONE_TEXT[tone]}`}
                      >
                        {Math.round(meter.current_value)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm text-ink">
                          {meter.name}
                        </span>
                        {/* C4 — the mode chip is dropped, not defaulted, if
                            the payload predates the column. */}
                        {meter.mode && (
                          <MeterModeBadge
                            mode={meter.mode}
                            className="text-[10px]"
                          />
                        )}
                      </div>
                      <ReadinessSparkline code={meter.code} days={30} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActivityFeedWidget />
        <TeamContributionWidget />
      </div>
    </div>
  );
}
