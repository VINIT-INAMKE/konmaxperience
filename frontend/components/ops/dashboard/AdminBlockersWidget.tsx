'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface BlockedTask {
  id: string;
  title: string;
  blocked_reason?: string | null;
  quest?: { id: string; title: string } | null;
}

export function AdminBlockersWidget() {
  const { data: blockedTasks, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks', 'blocked'],
    // GET /tasks has no `blocked` param — it was silently dropped and the
    // widget listed every task. The blocked set has its own route.
    queryFn: () => apiClient.get<BlockedTask[]>('/tasks/blocked'),
  });

  const count = blockedTasks?.length ?? 0;
  const display = blockedTasks?.slice(0, 5) ?? [];

  return (
    <Card className="border-l-2 border-l-destructive">
      <CardHeader>
        <CardTitle className="text-sm font-bold">Active Blockers</CardTitle>
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
              <div key={i} className="flex flex-col gap-1 animate-pulse motion-reduce:animate-none">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load blockers</AlertTitle>
            <AlertDescription>The blocked-task list did not respond.</AlertDescription>
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => void refetch()}>
              Retry
            </Button>
          </Alert>
        ) : display.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle className="size-8 text-[var(--status-good)]" />
            <p className="text-sm font-medium text-[var(--status-good)]">All clear</p>
            <p className="text-xs text-muted-foreground">All tasks are unblocked.</p>
            <Button nativeButton={false} render={<Link href="/tasks" />} variant="outline" size="sm">
              View all tasks
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {display.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="block rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              >
                <p className="text-sm font-medium truncate">{task.title}</p>
                {task.quest && (
                  <p className="text-xs text-muted-foreground truncate">
                    {task.quest.title}
                  </p>
                )}
                {task.blocked_reason && (
                  <p className="text-xs text-destructive truncate">
                    {task.blocked_reason.length > 60
                      ? task.blocked_reason.slice(0, 60) + '...'
                      : task.blocked_reason}
                  </p>
                )}
              </Link>
            ))}
            <div className="flex justify-end pt-1">
              <Link
                href="/tasks?status=blocked"
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
