'use client';

/**
 * The mission activity feed, extracted from `app/(ops)/activity` so the `/team`
 * hub's Activity tab and the standalone route render one list from one place
 * (SPEC §6.2 item 8 / Decision 11).
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  blocker_resolved: 'text-ink-muted',
};

const EVENT_LABELS: Record<string, string> = {
  validation: 'Validation',
  readiness: 'Readiness',
  quest_complete: 'Quest Complete',
  blocker_resolved: 'Blocker Resolved',
};

interface ActivityFeedListProps {
  /** Rows to request. */
  limit?: number;
  /** How far back to look. */
  hours?: number;
}

export function ActivityFeedList({
  limit = 100,
  hours = 168,
}: ActivityFeedListProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['activity-feed', { limit, hours }],
    queryFn: () =>
      apiClient.get<ActivityFeedItem[]>(
        `/activity?limit=${limit}&hours=${hours}`,
      ),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Could not load the activity feed</AlertTitle>
        <AlertDescription>
          Something went wrong fetching recent mission activity.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <Activity className="size-10 text-ink-faint" />
          <p className="text-sm font-medium">No mission activity yet</p>
          <p className="text-xs text-ink-muted">
            Complete and validate tasks to see the feed populate.
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/tasks" />}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            Go to tasks
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const Icon = EVENT_ICONS[item.type] ?? Activity;
        const color = EVENT_COLORS[item.type] ?? 'text-ink-muted';
        return (
          <Card key={item.id}>
            <CardContent className="px-4 py-3">
              <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight">{item.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {EVENT_LABELS[item.type] ?? item.type}
                    </Badge>
                    <span className="text-xs text-ink-muted">
                      {format(parseISO(item.timestamp), 'MMM d, h:mm a')} (
                      {formatDistanceToNow(new Date(item.timestamp), {
                        addSuffix: true,
                      })}
                      )
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
