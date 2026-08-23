'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, TrendingUp, Trophy, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { ActivityFeedItem } from '@/lib/types/activity';

const EVENT_ICONS: Record<string, typeof CheckCircle2> = {
  validation: CheckCircle2,
  readiness: TrendingUp,
  quest_complete: Trophy,
  blocker_resolved: Activity,
};

const EVENT_COLORS: Record<string, string> = {
  validation: 'text-[var(--status-good)]',
  readiness: 'text-[var(--status-info)]',
  quest_complete: 'text-[var(--status-warning)]',
  blocker_resolved: 'text-muted-foreground',
};

const EVENT_DOT_COLORS: Record<string, string> = {
  validation: 'bg-[var(--status-good)]',
  readiness: 'bg-[var(--status-info)]',
  quest_complete: 'bg-[var(--status-warning)]',
  blocker_resolved: 'bg-[var(--status-serious)]',
};

export function ActivityFeedWidget() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => apiClient.get<ActivityFeedItem[]>('/activity?limit=5'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold">Mission Activity</CardTitle>
        <CardAction>
          <Link
            href="/activity"
            className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          >
            View all activity
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse motion-reduce:animate-none">
                <div className="size-4 rounded bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
                <div className="h-3 w-12 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load Mission Activity</AlertTitle>
            <AlertDescription>The activity feed did not respond.</AlertDescription>
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => void refetch()}>
              Retry
            </Button>
          </Alert>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Activity className="size-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">No mission activity yet</p>
            <p className="text-xs text-muted-foreground">Complete and validate tasks to see the feed populate.</p>
            <Button nativeButton={false} render={<Link href="/tasks" />} variant="outline" size="sm">
              Go to tasks
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((item) => {
              const Icon = EVENT_ICONS[item.type] ?? Activity;
              const color = EVENT_COLORS[item.type] ?? 'text-muted-foreground';
              const dotColor = EVENT_DOT_COLORS[item.type] ?? 'bg-muted-foreground';
              return (
                <div key={item.id} className="flex items-start gap-2 text-sm">
                  <div className={`w-0.5 self-stretch shrink-0 rounded-full ${dotColor}`} />
                  <Icon className={`size-3.5 mt-0.5 shrink-0 ${color}`} />
                  <span className="flex-1 text-sm leading-tight">{item.description}</span>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
