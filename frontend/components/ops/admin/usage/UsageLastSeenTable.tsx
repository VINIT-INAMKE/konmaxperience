'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import type { UsageUserRow } from '@/lib/types/usage';
import { cn } from '@/lib/utils';
import { formatCount, usageRoleLabel } from './usage-labels';

type SortKey = 'last_seen' | 'page_views' | 'actions' | 'name';

interface UsageLastSeenTableProps {
  rows: UsageUserRow[];
  /** `Date.now()` at render, threaded in so every relative label agrees. */
  now: number;
}

const NEVER = 'never';

/**
 * Module-level, not a closure inside the table: a component declared during
 * render is a fresh type on every pass and remounts its subtree
 * (`react-hooks/static-components`).
 */
function SortableHead({
  column,
  label,
  activeKey,
  descending,
  numeric,
  onSort,
}: {
  column: SortKey;
  label: string;
  activeKey: SortKey;
  descending: boolean;
  numeric?: boolean;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === column;
  const Arrow = descending ? ArrowDown : ArrowUp;
  return (
    <TableHead className={numeric ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}`}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          active ? 'text-ink-strong' : 'text-ink-muted hover:text-ink',
        )}
      >
        {label}
        {active && <Arrow className="size-3" aria-hidden="true" />}
      </button>
    </TableHead>
  );
}

/**
 * Per-person activity: page views, actions and last-seen.
 *
 * Two things this table is deliberately *not*: it is not a roster — a user with
 * no event inside the window is absent, not a zero row — and it is not the whole
 * story, because anonymous storefront traffic has no user to attribute and lives
 * only in the role split above.
 *
 * `last_seen_at` is nullable, so the sort puts a never-seen user last rather
 * than letting `null` collapse to epoch and float to the top.
 */
export function UsageLastSeenTable({ rows, now }: UsageLastSeenTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('last_seen');
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    const seen = (row: UsageUserRow) =>
      row.last_seen_at ? new Date(row.last_seen_at).getTime() : null;

    const compare = (a: UsageUserRow, b: UsageUserRow): number => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'page_views') return a.page_views - b.page_views;
      if (sortKey === 'actions') return a.actions - b.actions;
      const left = seen(a);
      const right = seen(b);
      // A never-seen user sorts last in *either* direction: "no reading" is not
      // a small reading, so it never wins the top of the ascending list either.
      if (left === null && right === null) return 0;
      if (left === null) return descending ? -1 : 1;
      if (right === null) return descending ? 1 : -1;
      return left - right;
    };

    return [...rows].sort((a, b) => {
      const delta = compare(a, b);
      if (delta !== 0) return descending ? -delta : delta;
      return a.name.localeCompare(b.name);
    });
  }, [rows, sortKey, descending]);

  const toggle = (key: SortKey) => {
    if (key === sortKey) {
      setDescending((value) => !value);
      return;
    }
    setSortKey(key);
    setDescending(key !== 'name');
  };

  const sortProps = { activeKey: sortKey, descending, onSort: toggle };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-ink-strong">Who was active</CardTitle>
        <CardDescription>
          Staff only, one row per person with at least one event in the window.
          Anonymous storefront traffic has no user and is excluded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            No staff activity recorded yet for this window.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead column="name" label="User" {...sortProps} />
                <TableHead>Role</TableHead>
                <SortableHead column="page_views" label="Page views" numeric {...sortProps} />
                <SortableHead column="actions" label="Actions" numeric {...sortProps} />
                <SortableHead column="last_seen" label="Last seen" numeric {...sortProps} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.user_id}>
                  <TableCell className="font-medium text-ink-strong">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{usageRoleLabel(row.role_code)}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCount(row.page_views)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCount(row.actions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.last_seen_at ? (
                      <span title={formatDateTime(row.last_seen_at)}>
                        {formatRelative(row.last_seen_at, now)}
                      </span>
                    ) : (
                      <span className="text-ink-faint">{NEVER}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
