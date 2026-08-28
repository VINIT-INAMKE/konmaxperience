'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Sunrise } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { optionalGet } from '@/lib/api/optional';
import { MORNING_BRIEF_STALE_HOURS, type MorningBrief } from '@/lib/types/ai';

function hoursSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return (Date.now() - then) / 3_600_000;
}

/** "Just now" / "3h ago" / "2d ago" — the dashboard's relative-time idiom. */
function formatRelativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(diffMin) || diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

/**
 * `reference_id` is the business date the brief reports on (`YYYY-MM-DD`), which
 * is the honest thing to name when a brief is stale — `created_at` says when the
 * cron ran, not which day the numbers describe. Falls back to the creation date
 * if the row predates the field.
 */
function briefDateLabel(brief: MorningBrief): string {
  const source = brief.reference_id ?? brief.created_at;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return source;
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * RUN-05 — the 07:00 brief, at the top of Mission Control's Status column.
 *
 * Two decisions worth keeping:
 *
 * - **The card drops itself rather than showing an empty shell** (decision 24).
 *   `optionalGet` turns a 404, a 403 or a not-yet-deployed endpoint into `null`,
 *   and `null` renders nothing at all. A dashboard that shows "no brief today"
 *   every day trains people to ignore the space where the brief goes.
 * - **`body` is rendered verbatim.** The backend already laid it out with `•`
 *   bullets and `→` actions; `whitespace-pre-line` preserves that. Re-parsing it
 *   into a structure here would be a second renderer to keep in step with the
 *   first, and the first is the one that also goes out over WhatsApp.
 */
export function MorningBriefCard() {
  const { data: brief, isLoading } = useQuery({
    queryKey: ['ai', 'morning-brief', 'latest'],
    queryFn: () => optionalGet<MorningBrief>('/ai/morning-brief/latest'),
    staleTime: 10 * 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  // No brief, no permission, no endpoint — the card is simply not there.
  if (!brief) return null;

  const isStale = hoursSince(brief.created_at) > MORNING_BRIEF_STALE_HOURS;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Sunrise className="size-4 text-ink-muted" aria-hidden="true" />
            {brief.title}
          </h3>
          <div className="flex items-center gap-2">
            {/* A brief older than a day and a half must not be read as this
                morning's. The date it covers is stated, not implied. */}
            {isStale && (
              <span className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[11px] text-ink-muted">
                from {briefDateLabel(brief)}
              </span>
            )}
            <span className="text-xs text-ink-muted">
              {formatRelativeTime(brief.created_at)}
            </span>
          </div>
        </div>

        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
          {brief.body}
        </p>

        {brief.link_url && (
          <Link
            href={brief.link_url}
            className="inline-block rounded-sm text-xs text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] motion-reduce:transition-none"
          >
            Open the detail
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
