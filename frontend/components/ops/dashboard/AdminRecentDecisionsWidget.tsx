'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import type { Decision, DecisionType, DecisionStatus } from '@/lib/types/decisions';

const TYPE_LABELS: Record<DecisionType, string> = {
  individual: 'Individual',
  cross_function: 'Cross-fn',
  strategic: 'Strategic',
};

function statusBadgeClass(status: DecisionStatus): string {
  switch (status) {
    case 'proposed':
      return 'bg-amber-500/15 text-amber-600 border-0';
    case 'approved':
      return 'bg-emerald-500/15 text-emerald-700 border-0';
    case 'rejected':
      return 'bg-destructive/10 text-destructive border-0';
    default:
      return '';
  }
}

export function AdminRecentDecisionsWidget() {
  const { data: decisions, isLoading } = useQuery({
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
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-4 flex-1 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-4 w-14 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : display.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No decisions yet.
          </p>
        ) : (
          <div className="space-y-2">
            {display.map((decision) => (
              <Link
                key={decision.id}
                href="/decisions"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
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
