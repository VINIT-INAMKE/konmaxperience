'use client';

import { useState, useMemo } from 'react';
import { CheckCircle, Search, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ApprovalItem } from './ApprovalItem';
import type { Approval } from '@/lib/types/approvals';
import {
  APPROVAL_ENTITY_GROUP_LABELS,
  APPROVAL_ENTITY_ORDER,
} from '@/lib/types/approvals';

interface ApprovalQueueProps {
  approvals: Approval[];
  isLoading: boolean;
  isError: boolean;
  /** Group the rows under entity headings — only useful on the "All" tab. */
  groupByEntity: boolean;
  onAction: () => void;
}

/** Oldest first: the row that has waited longest is the most urgent. */
function byAge(a: Approval, b: Approval) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export function ApprovalQueue({
  approvals,
  isLoading,
  isError,
  groupByEntity,
  onAction,
}: ApprovalQueueProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = query
      ? approvals.filter(
          (a) =>
            a.subject?.title.toLowerCase().includes(query) ||
            a.required_role_code.toLowerCase().includes(query),
        )
      : approvals;
    return [...rows].sort(byAge);
  }, [approvals, search]);

  const groups = useMemo(() => {
    if (!groupByEntity) return null;
    return APPROVAL_ENTITY_ORDER.map((entityType) => ({
      entityType,
      rows: filtered.filter((a) => a.entity_type === entityType),
    })).filter((group) => group.rows.length > 0);
  }, [filtered, groupByEntity]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[116px] rounded-lg bg-surface-raised animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <AlertCircle className="size-10 text-serious" />
        <p className="text-sm text-ink-muted">
          Can&apos;t load approvals right now. Try refreshing.
        </p>
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <CheckCircle className="size-12 text-good" />
        <h2 className="text-xl font-semibold text-ink">No pending approvals</h2>
        <p className="text-sm text-ink-muted">You&apos;re all caught up.</p>
      </div>
    );
  }

  const renderRows = (rows: Approval[]) => (
    <div className="space-y-3">
      {rows.map((approval) => (
        <ApprovalItem
          key={approval.id}
          approval={approval}
          onAction={onAction}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-end gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            placeholder="Filter by subject or role..."
            aria-label="Filter approvals"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-ink-muted">
            No approvals match your filter.
          </p>
        </div>
      ) : groups ? (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.entityType} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {APPROVAL_ENTITY_GROUP_LABELS[group.entityType]}
                <span className="ml-2 font-normal text-ink-faint">
                  {group.rows.length}
                </span>
              </h2>
              {renderRows(group.rows)}
            </section>
          ))}
        </div>
      ) : (
        renderRows(filtered)
      )}
    </div>
  );
}
