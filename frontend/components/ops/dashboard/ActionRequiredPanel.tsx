'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  PackageMinus,
  Plus,
  Stamp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdHocTaskSheet } from '@/components/ops/tasks/AdHocTaskSheet';
import { optionalGet } from '@/lib/api/optional';
import { P31 } from '@/lib/api/phase31';
import { useAuthStore } from '@/lib/stores/auth-store';
import { cn } from '@/lib/utils';
import { Permission } from '@/lib/types/permissions';
import type { Approval } from '@/lib/types/approvals';
import type { Decision } from '@/lib/types/decisions';
import type { Evidence } from '@/lib/types/evidence';
import type { IngredientStock } from '@/lib/types/inventory';

/** A proposed decision counts as stale once it has sat this long undecided. */
const STALE_DECISION_DAYS = 7;

type RowTone = 'warning' | 'serious' | 'critical';

const TONE_ICON_CLASS: Record<RowTone, string> = {
  warning:
    'bg-[var(--status-warning)]/12 text-[var(--status-warning)] ring-[var(--status-warning)]/20',
  serious:
    'bg-[var(--status-serious)]/12 text-[var(--status-serious)] ring-[var(--status-serious)]/20',
  critical:
    'bg-[var(--status-critical)]/12 text-[var(--status-critical)] ring-[var(--status-critical)]/20',
};

interface BlockedTask {
  id: string;
  title: string;
}

interface ActionRow {
  key: string;
  count: number;
  /** One line. Says what is waiting and on whom, never a bare noun. */
  label: string;
  href: string;
  cta: string;
  tone: RowTone;
  icon: typeof Stamp;
  /** Set when the row is answering from a fallback source, not the real one. */
  note?: string;
}

export function ActionRequiredPanel() {
  const permissions = useAuthStore((s) => s.permissions);
  const [adHocOpen, setAdHocOpen] = useState(false);

  /**
   * Approvals waiting on the caller. `GET /approvals/count` is the real answer;
   * when the approvals surface is not reachable (404, or 403 for a role without
   * `APPROVE_EVIDENCE`) the row falls back to the pending-evidence count, which
   * is what the sidebar badge counted before the queue became polymorphic.
   */
  const approvals = useQuery({
    queryKey: ['action-required', 'approvals'],
    queryFn: async () => {
      const counted = await optionalGet<{ count: number }>(
        P31.myPendingApprovalCount,
      );
      if (counted) return { count: counted.count, fallback: false };

      const rows = await optionalGet<Approval[]>(P31.myPendingApprovals);
      if (rows) return { count: rows.length, fallback: false };

      const evidence = await optionalGet<Evidence[]>('/evidence?status=pending');
      return { count: evidence?.length ?? 0, fallback: true };
    },
    refetchInterval: 60_000,
  });

  /**
   * `Task.blocked` is a flag of its own, not only a status, so the blocked set
   * has a dedicated route; `?status=blocked` would miss a task that is flagged
   * blocked while still `doing`. The deep link uses the filter the list page
   * understands.
   */
  const blockers = useQuery({
    queryKey: ['action-required', 'blockers'],
    queryFn: () => optionalGet<BlockedTask[]>('/tasks/blocked'),
  });

  const decisions = useQuery({
    queryKey: ['action-required', 'stale-decisions'],
    queryFn: () => optionalGet<Decision[]>(P31.proposedDecisions),
  });

  const lowStock = useQuery({
    queryKey: ['action-required', 'low-stock'],
    queryFn: () => optionalGet<IngredientStock[]>('/inventory/low-stock'),
  });

  // Failed shipments belong in this list (SPEC §6.5) but `Shipment` and its
  // queue arrive with the marketplace in Phase 34. The row is left out rather
  // than stubbed, so nothing here renders a number that cannot be trusted.

  const isLoading =
    approvals.isLoading ||
    blockers.isLoading ||
    decisions.isLoading ||
    lowStock.isLoading;

  const staleCutoff = Date.now() - STALE_DECISION_DAYS * 24 * 60 * 60 * 1000;
  const staleDecisions = (decisions.data ?? []).filter(
    (decision) => new Date(decision.created_at).getTime() < staleCutoff,
  ).length;

  const approvalCount = approvals.data?.count ?? 0;
  const blockerCount = blockers.data?.length ?? 0;
  const lowStockCount = lowStock.data?.length ?? 0;

  const allRows: ActionRow[] = [
    {
      key: 'approvals',
      count: approvalCount,
      label:
        approvalCount === 1
          ? 'approval is waiting on you'
          : 'approvals are waiting on you',
      href: '/approvals',
      cta: 'Review',
      tone: 'warning',
      icon: Stamp,
      note: approvals.data?.fallback
        ? 'Counting pending evidence — the approvals queue is not reachable.'
        : undefined,
    },
    {
      key: 'blockers',
      count: blockerCount,
      label: blockerCount === 1 ? 'task is blocked' : 'tasks are blocked',
      href: '/tasks?status=blocked',
      cta: 'Unblock',
      tone: 'critical',
      icon: AlertTriangle,
    },
    {
      key: 'decisions',
      count: staleDecisions,
      label:
        staleDecisions === 1
          ? `decision has been proposed for over ${STALE_DECISION_DAYS} days`
          : `decisions have been proposed for over ${STALE_DECISION_DAYS} days`,
      href: '/decisions',
      cta: 'Decide',
      tone: 'serious',
      icon: GitBranch,
    },
    {
      key: 'low-stock',
      count: lowStockCount,
      label:
        lowStockCount === 1
          ? 'ingredient is below its minimum'
          : 'ingredients are below their minimum',
      href: '/operations/inventory',
      cta: 'Reorder',
      tone: 'warning',
      icon: PackageMinus,
    },
  ];

  const rows = allRows.filter((row) => row.count > 0);

  const canInjectTask = permissions.includes(Permission.CREATE_ADHOC_TASK);

  return (
    <>
      <Card>
        <CardContent>
          {isLoading ? (
            <ul className="divide-y divide-line">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <Skeleton className="h-4 w-48 max-w-[60%]" />
                  <Skeleton className="ml-auto h-7 w-20 shrink-0" />
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <div className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--status-good)]/12 text-[var(--status-good)] ring-1 ring-[var(--status-good)]/20">
                <CheckCircle2 className="size-4" aria-hidden="true" />
              </span>
              <p className="text-sm text-ink">Nothing needs you right now.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((row) => {
                const Icon = row.icon;
                return (
                  <li
                    key={row.key}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
                        TONE_ICON_CLASS[row.tone],
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <p className="min-w-0 flex-1 text-sm text-ink">
                      <span className="mr-1.5 text-base font-semibold tabular-nums text-ink-strong">
                        {row.count}
                      </span>
                      {row.label}
                      {row.note && (
                        <span className="block text-xs text-ink-muted">
                          {row.note}
                        </span>
                      )}
                    </p>
                    <Button
                      nativeButton={false}
                      render={<Link href={row.href} />}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      {row.cta}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {canInjectTask && (
            <div className="mt-1 border-t border-line pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdHocOpen(true)}
              >
                <Plus aria-hidden="true" />
                New ad-hoc task
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canInjectTask && (
        <AdHocTaskSheet open={adHocOpen} onOpenChange={setAdHocOpen} />
      )}
    </>
  );
}
