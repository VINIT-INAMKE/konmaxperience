'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import { MagicCard } from '@/components/ui/magic-card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

interface BlockedTask {
  id: string;
  title: string;
  blocked_reason?: string | null;
  quest?: { id: string; title: string } | null;
}

export function AdminBlockersWidget() {
  const { data: blockedTasks, isLoading } = useQuery({
    queryKey: ['tasks', 'blocked'],
    // GET /tasks has no `blocked` param — it was silently dropped and the
    // widget listed every task. The blocked set has its own route.
    queryFn: () => apiClient.get<BlockedTask[]>('/tasks/blocked'),
  });

  const count = blockedTasks?.length ?? 0;
  const display = blockedTasks?.slice(0, 5) ?? [];

  return (
    <MagicCard gradientColor={GRADIENT_OVERLAY} className="rounded-xl border-l-2 border-l-destructive">
      <div className="flex flex-col gap-4 py-4 text-sm">
        {/* Header */}
        <div className="grid auto-rows-min items-start gap-1 px-4 grid-cols-[1fr_auto]">
          <div className="text-sm font-bold">Active Blockers</div>
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
                <div key={i} className="flex flex-col gap-1 animate-pulse">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : display.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle className="size-8 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All clear</p>
              <p className="text-xs text-muted-foreground">All tasks are unblocked.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {display.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="block rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
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
                  href="/admin/blockers"
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
