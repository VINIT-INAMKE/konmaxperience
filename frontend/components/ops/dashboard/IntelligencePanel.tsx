'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardKpiAlert } from './DashboardKpiAlert';
import { DashboardLeaderboardPreview } from './DashboardLeaderboardPreview';
import { optionalGet } from '@/lib/api/optional';
import { P31, type BridgeDispatch, type BridgeOutcome } from '@/lib/api/phase31';
import { cn } from '@/lib/utils';
import type { TopItem } from '@/lib/types/analytics';
import type { Feedback } from '@/lib/types/feedback';
import type { Kpi } from '@/lib/types/kpi';
import type { LeaderboardResponse } from '@/lib/types/leaderboard';

/** The look-back both intelligence reads share. */
const WINDOW_DAYS = 30;

interface Band {
  key: string;
  label: string;
  /** Inclusive rating range. */
  min: number;
  max: number;
  barClass: string;
  textClass: string;
}

const BANDS: Band[] = [
  {
    key: 'promoters',
    label: 'Delighted (4–5★)',
    min: 4,
    max: 5,
    barClass: 'bg-[var(--status-good)]',
    textClass: 'text-[var(--status-good)]',
  },
  {
    key: 'passives',
    label: 'Fine (3★)',
    min: 3,
    max: 3,
    barClass: 'bg-[var(--status-warning)]',
    textClass: 'text-[var(--status-warning)]',
  },
  {
    key: 'detractors',
    label: 'Unhappy (1–2★)',
    min: 1,
    max: 2,
    barClass: 'bg-[var(--status-serious)]',
    textClass: 'text-[var(--status-serious)]',
  },
];

function dayKey(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function SectionCard({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {href && linkLabel && (
            <Link
              href={href}
              className="rounded-sm text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            >
              {linkLabel}
            </Link>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * The ledger records *why* a rule skipped (`skipped_no_task`, `…_no_mission`,
 * `…_no_owner`). On a summary card that detail is noise: a skip is a skip, and
 * the reason belongs in the ledger itself.
 */
function outcomeClass(outcome: BridgeOutcome): string {
  if (outcome === 'applied') return 'text-[var(--status-good)]';
  if (outcome === 'failed') return 'text-[var(--status-serious)]';
  return 'text-ink-faint';
}

function outcomeLabel(outcome: BridgeOutcome): string {
  if (outcome === 'applied' || outcome === 'failed') return outcome;
  return 'skipped';
}

/**
 * What the mission bridge has actually done lately — the automation that turns
 * ops events into evidence and meter signals. `MANAGE_SYSTEM`-gated, so the
 * block simply does not appear for a viewer who cannot see the ledger.
 */
function BridgeActivityBlock() {
  const { data, isLoading } = useQuery({
    queryKey: ['mission-bridge', 'dispatches'],
    queryFn: () => optionalGet<BridgeDispatch[]>(P31.bridgeDispatches(6)),
  });

  if (isLoading) {
    return (
      <SectionCard title="Bridge activity">
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!data) return null;

  return (
    <SectionCard title="Bridge activity">
      {data.length === 0 ? (
        <p className="text-sm text-ink-muted">
          The bridge has not fired yet — it reacts to orders, receipts and prep
          batches.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((dispatch) => (
            <li
              key={dispatch.id}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-ink">
                {dispatch.event.replace(/[._]/g, ' ')}
              </span>
              <span
                className={cn('shrink-0 text-xs', outcomeClass(dispatch.outcome))}
              >
                {outcomeLabel(dispatch.outcome)}
              </span>
              <span className="shrink-0 text-xs text-ink-faint">
                {formatDistanceToNow(new Date(dispatch.created_at), {
                  addSuffix: true,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/**
 * SPEC §6.5 "Intelligence" — KPI alerts, top products and the feedback mix.
 *
 * Every read here is optional: analytics is gated on `MANAGE_KPIS` and feedback
 * on `MANAGE_POS`, so a Mission Control viewer holding neither sees the KPI
 * alerts and nothing else, rather than three error cards.
 */
export function IntelligencePanel() {
  const from = dayKey(WINDOW_DAYS);
  const to = dayKey(0);

  const kpis = useQuery({
    queryKey: ['kpis'],
    queryFn: () => optionalGet<Kpi[]>('/kpis'),
  });

  const topItems = useQuery({
    queryKey: ['analytics', 'top-items', from, to],
    queryFn: () =>
      optionalGet<TopItem[]>(`/analytics/top-items?from=${from}&to=${to}`),
  });

  const feedback = useQuery({
    queryKey: ['feedback-list', 'intelligence', from],
    queryFn: () =>
      optionalGet<Feedback[]>(`/feedback?date_from=${from}&limit=100`),
  });

  const rows = feedback.data ?? [];
  const total = rows.length;
  const bands = BANDS.map((band) => {
    const matched = rows.filter(
      (row) => row.rating >= band.min && row.rating <= band.max,
    );
    const withComment = matched.find(
      (row) => row.comment && row.comment.trim().length > 0,
    );
    return {
      ...band,
      count: matched.length,
      share: total > 0 ? Math.round((matched.length / total) * 100) : 0,
      quote: withComment?.comment?.trim() ?? null,
    };
  });

  const topFive = (topItems.data ?? []).slice(0, 5);
  // The bar is relative to the biggest row on screen, not to the first — the
  // endpoint's sort order is not part of its contract.
  const maxRevenue = Math.max(1, ...topFive.map((item) => item.revenue));

  const showKpis = kpis.isLoading || Boolean(kpis.data);
  const showTopItems = topItems.isLoading || Boolean(topItems.data);
  const showFeedback = feedback.isLoading || Boolean(feedback.data);

  return (
    <div className="space-y-4">
      {showKpis &&
        (kpis.isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          kpis.data && <DashboardKpiAlert kpis={kpis.data} />
        ))}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {showTopItems && (
          <SectionCard
            title={`Top products · last ${WINDOW_DAYS} days`}
            href="/intelligence/analytics"
            linkLabel="Analytics"
          >
            {topItems.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : topFive.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No products sold in this window yet.
              </p>
            ) : (
              <ol className="space-y-2">
                {topFive.map((item, index) => (
                  <li key={item.product_id} className="space-y-1">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="w-4 shrink-0 text-right text-xs tabular-nums text-ink-faint">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {item.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-muted">
                        ₹{Math.round(item.revenue).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="ml-6 h-1 overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{
                          width: `${Math.max(4, Math.round((item.revenue / maxRevenue) * 100))}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        )}

        {showFeedback && (
          <SectionCard
            title={`Feedback mix · last ${WINDOW_DAYS} days`}
            href="/operations/feedback"
            linkLabel="All feedback"
          >
            {feedback.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : total === 0 ? (
              <p className="text-sm text-ink-muted">
                No customer feedback in this window yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {bands.map((band) => (
                  <li key={band.key} className="space-y-1">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {band.label}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 tabular-nums',
                          band.count > 0 ? band.textClass : 'text-ink-faint',
                        )}
                      >
                        {band.count} · {band.share}%
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className={cn('h-full rounded-full', band.barClass)}
                        style={{ width: `${band.share}%` }}
                      />
                    </div>
                    {band.quote && (
                      <p className="truncate text-xs text-ink-muted">
                        &ldquo;{band.quote}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BridgeActivityBlock />
        <LeaderboardBlock />
      </div>
    </div>
  );
}

/**
 * The leaderboard is a settings kill-switch away from being off entirely, so it
 * carries its own query and renders nothing when disabled.
 */
function LeaderboardBlock() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => optionalGet<LeaderboardResponse>('/leaderboard'),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-24" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.enabled) return null;

  return (
    <Card>
      <CardContent>
        <DashboardLeaderboardPreview data={data} />
      </CardContent>
    </Card>
  );
}
