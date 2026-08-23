'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { Evidence } from '@/lib/types/evidence';
import { EVIDENCE_TYPE_LABELS } from '@/lib/types/evidence';

export function AdminPendingApprovalsWidget() {
  const { data: pendingEvidence, isLoading, isError, refetch } = useQuery({
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
    <Card className="border-l-2 border-l-[var(--status-warning)]">
      <CardHeader>
        <CardTitle className="text-sm font-bold">Pending Approvals</CardTitle>
        <CardAction>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse motion-reduce:animate-none">
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
                <div className="h-4 w-12 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load pending approvals</AlertTitle>
            <AlertDescription>The evidence queue did not respond.</AlertDescription>
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => void refetch()}>
              Retry
            </Button>
          </Alert>
        ) : display.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle className="size-8 text-[var(--status-good)]" />
            <p className="text-sm font-medium text-[var(--status-good)]">All clear</p>
            <p className="text-xs text-muted-foreground">No approvals waiting.</p>
            <Button nativeButton={false} render={<Link href="/approvals" />} variant="outline" size="sm">
              Open approvals
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {display.map((evidence) => (
              <Link
                key={evidence.id}
                href="/approvals"
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
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
                className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              >
                View all
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
