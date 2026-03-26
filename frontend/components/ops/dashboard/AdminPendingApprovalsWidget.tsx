'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { MagicCard } from '@/components/ui/magic-card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import type { Evidence } from '@/lib/types/evidence';
import { EVIDENCE_TYPE_LABELS } from '@/lib/types/evidence';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

export function AdminPendingApprovalsWidget() {
  const { data: pendingEvidence, isLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => apiClient.get<Evidence[]>('/evidence?status=pending'),
    refetchInterval: 60_000,
  });

  const count = pendingEvidence?.length ?? 0;

  // Sort by created_at ascending (oldest first — longest waiting)
  const sorted = pendingEvidence
    ? [...pendingEvidence].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
    : [];
  const display = sorted.slice(0, 5);

  return (
    <MagicCard gradientColor={GRADIENT_OVERLAY} className="rounded-xl border-l-2 border-l-amber-500">
      <div className="flex flex-col gap-4 py-4 text-sm">
        {/* Header */}
        <div className="grid auto-rows-min items-start gap-1 px-4 grid-cols-[1fr_auto]">
          <div className="text-sm font-bold">Pending Approvals</div>
          <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
            {!isLoading && (
              <Badge variant="secondary" className="text-xs">
                {count}
              </Badge>
            )}
          </div>
        </div>
        {/* Content */}
        <div className="px-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-4 w-16 rounded bg-muted" />
                  <div className="h-4 flex-1 rounded bg-muted" />
                  <div className="h-4 w-12 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : display.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle className="size-8 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All clear</p>
              <p className="text-xs text-muted-foreground">No approvals waiting.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {display.map((evidence) => (
                <Link
                  key={evidence.id}
                  href="/approvals"
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {EVIDENCE_TYPE_LABELS[evidence.type]}
                  </Badge>
                  <span className="flex-1 truncate text-muted-foreground">
                    {evidence.uploader?.name ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(evidence.created_at), { addSuffix: false })}
                  </span>
                </Link>
              ))}
              <div className="flex justify-end pt-1">
                <Link
                  href="/approvals"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </MagicCard>
  );
}
