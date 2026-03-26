'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, TrendingUp, Trophy, Activity } from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { BlurFade } from '@/components/ui/blur-fade';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

const EVENT_LABELS: Record<string, string> = {
  validation: 'Validation',
  readiness: 'Readiness',
  quest_complete: 'Quest Complete',
  blocker_resolved: 'Blocker Resolved',
};

export default function ActivityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['activity-feed', 'full'],
    queryFn: () => apiClient.get<ActivityFeedItem[]>('/activity?limit=100&hours=168'),
  });

  return (
    <BlurFade>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Activity Feed</h1>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="size-4 rounded bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <Activity className="size-10 text-muted-foreground/30" />
              <p className="text-sm font-medium">No mission activity yet</p>
              <p className="text-xs text-muted-foreground">
                Complete and validate tasks to see the feed populate.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.map((item) => {
              const Icon = EVENT_ICONS[item.type] ?? Activity;
              const color = EVENT_COLORS[item.type] ?? 'text-muted-foreground';
              return (
                <Card key={item.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`size-4 mt-0.5 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight">{item.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {EVENT_LABELS[item.type] ?? item.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(item.timestamp), 'MMM d, h:mm a')} ({formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })})
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </BlurFade>
  );
}
