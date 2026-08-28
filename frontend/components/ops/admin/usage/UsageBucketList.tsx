'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCount } from './usage-labels';

export interface UsageBucketRow {
  /** Stable React key — the raw path or action key. */
  id: string;
  /** What the reader sees. */
  label: string;
  /** Secondary line, e.g. the raw dotted action key behind a prettified label. */
  hint?: string;
  count: number;
  /** Rendered as a link when the bucket is an in-app route. */
  href?: string;
}

interface UsageBucketListProps {
  title: string;
  description: string;
  rows: UsageBucketRow[];
  /** Shown in place of the list when `rows` is empty. */
  emptyLabel: string;
  /** Noun for the count column's screen-reader label. */
  unit: string;
}

/**
 * A ranked bucket list — top paths, top actions — with a proportional bar
 * behind each row.
 *
 * The bar is a tokenised `div` scaled against the busiest row rather than a
 * chart: at 25 rows a recharts axis buys nothing a percentage width does not,
 * and the row stays a real link when the bucket names a route.
 */
export function UsageBucketList({
  title,
  description,
  rows,
  emptyLabel,
  unit,
}: UsageBucketListProps) {
  const max = rows.reduce((peak, row) => Math.max(peak, row.count), 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-ink-strong">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">{emptyLabel}</p>
        ) : (
          <ol className="space-y-1.5">
            {rows.map((row) => {
              const pct = max > 0 ? Math.max(2, Math.round((row.count / max) * 100)) : 0;
              return (
                <li key={row.id} className="relative overflow-hidden rounded-md">
                  <div
                    className="absolute inset-y-0 left-0 bg-brand-soft"
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                  <div className="relative flex items-baseline justify-between gap-3 px-2.5 py-1.5">
                    <div className="min-w-0">
                      {row.href ? (
                        <Link
                          href={row.href}
                          className="block truncate rounded-sm text-sm text-ink-strong underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {row.label}
                        </Link>
                      ) : (
                        <span className="block truncate text-sm text-ink-strong">
                          {row.label}
                        </span>
                      )}
                      {row.hint && (
                        <span className="block truncate font-mono text-xs text-ink-faint">
                          {row.hint}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-ink-strong">
                      {formatCount(row.count)}
                      <span className="sr-only"> {unit}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
