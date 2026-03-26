'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, TrendingUp, Trophy, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import type { ActivityFeedItem } from '@/lib/types/activity';

const EVENT_ICONS: Record<string, typeof CheckCircle2> = {
  validation: CheckCircle2,
  readiness: TrendingUp,
  quest_complete: Trophy,
  blocker_resolved: Activity,
};

const EVENT_COLORS: Record<string, string> = {
  validation: 'text-emerald-500',
  readiness: 'text-blue-500',
  quest_complete: 'text-amber-500',
  blocker_resolved: 'text-muted-foreground',
};

const EVENT_DOT_COLORS: Record<string, string> = {
  validation: 'bg-emerald-500',
  readiness: 'bg-blue-500',
  quest_complete: 'bg-amber-500',
  blocker_resolved: 'bg-red-500',
};

export function ActivityFeedWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => apiClient.get<ActivityFeedItem[]>('/activity?limit=5'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold">Mission Activity</CardTitle>
        <CardAction>
          <Link href="/activity" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all activity
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="size-4 rounded bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
                <div className="h-3 w-12 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Could not load Mission Activity. Refresh to try again.</p>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Activity className="size-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">No mission activity yet</p>
            <p className="text-xs text-muted-foreground">Complete and validate tasks to see the feed populate.</p>
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
