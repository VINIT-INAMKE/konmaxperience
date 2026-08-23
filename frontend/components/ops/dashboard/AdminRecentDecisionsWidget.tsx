'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GitBranch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { Decision, DecisionType, DecisionStatus } from '@/lib/types/decisions';

const TYPE_LABELS: Record<DecisionType, string> = {
  individual: 'Individual',
  cross_function: 'Cross-fn',
  strategic: 'Strategic',
};

function statusBadgeClass(status: DecisionStatus): string {
  switch (status) {
    case 'proposed':
      return STATUS_BADGE.warning;
    case 'approved':
      return STATUS_BADGE.good;
    case 'rejected':
      return STATUS_BADGE.serious;
    default:
      return '';
  }
}

export function AdminRecentDecisionsWidget() {
  const { data: decisions, isLoading, isError, refetch } = useQuery({
    queryKey: ['decisions', 'recent'],
    queryFn: () => apiClient.get<Decision[]>('/decisions'),
  });

  // Sort by created_at desc, take first 5
  const sorted = decisions
    ? [...decisions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    : [];
  const display = sorted.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold">Recent Decisions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse motion-reduce:animate-none">
                <div className="h-4 flex-1 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-4 w-14 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load recent decisions</AlertTitle>
            <AlertDescription>The decision log did not respond.</AlertDescription>
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => void refetch()}>
              Retry
            </Button>
          </Alert>
        ) : display.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <GitBranch className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No decisions logged yet.</p>
            <Button nativeButton={false} render={<Link href="/decisions" />} variant="outline" size="sm">
              Log a decision
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {display.map((decision) => (
              <Link
                key={decision.id}
                href="/decisions"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              >
                <span className="flex-1 text-sm truncate">
                  {decision.title.length > 40
                    ? decision.title.slice(0, 40) + '...'
                    : decision.title}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {TYPE_LABELS[decision.decision_type]}
                </Badge>
                <Badge className={`text-[10px] shrink-0 ${statusBadgeClass(decision.status)}`}>
                  {decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
                </Badge>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(decision.created_at), { addSuffix: true })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
