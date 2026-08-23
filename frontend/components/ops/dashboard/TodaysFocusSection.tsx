'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { isToday, isPast, parseISO, format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/lib/stores/auth-store';

interface FocusTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  owner_user_id: string;
  completed_at: string | null;
  priority: string;
  quest_id: string | null;
  quest?: { id: string; title: string } | null;
}

interface TodaysFocusSectionProps {
  allTasks: FocusTask[] | undefined;
  isLoading?: boolean;
  /** How many rows to show before the list becomes noise. */
  limit?: number;
}

const priorityOrder: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * SPEC §6.5 — the first and widest block of My Day: overdue, then due today,
 * then quest-linked by priority. The caller supplies the task set (My Day reads
 * `GET /tasks?mine=1&limit=50`), so this component owns the ordering and nothing
 * else.
 */
export function TodaysFocusSection({
  allTasks,
  isLoading = false,
  limit = 5,
}: TodaysFocusSectionProps) {
  const user = useAuthStore((s) => s.user);

  const focusItems = useMemo(() => {
    if (!allTasks || !user) return [];

    const myTasks = allTasks.filter(
      (t) =>
        t.owner_user_id === user.id &&
        t.status !== 'done' &&
        t.status !== 'cancelled',
    );

    const overdue = myTasks.filter(
      (t) =>
        t.due_date &&
        isPast(parseISO(t.due_date)) &&
        !t.completed_at &&
        !isToday(parseISO(t.due_date)),
    );

    const dueToday = myTasks.filter(
      (t) => t.due_date && isToday(parseISO(t.due_date)) && !t.completed_at,
    );

    const questTasks = myTasks
      .filter((t) => t.quest_id && !overdue.includes(t) && !dueToday.includes(t))
      .sort(
        (a, b) => (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0),
      );

    return [...overdue, ...dueToday, ...questTasks].slice(0, limit);
  }, [allTasks, user, limit]);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <ul className="divide-y divide-line">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <Skeleton className="h-4 min-w-0 flex-1" />
                <Skeleton className="h-3 w-16 shrink-0" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  if (focusItems.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2
            className="size-8 text-[var(--status-good)]"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-ink">Nothing is due on you.</p>
          <p className="max-w-sm text-xs text-ink-muted">
            Work lands here when a quest is assigned to you or a task you own
            reaches its due date.
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/tasks" />}
            variant="outline"
            size="sm"
            className="mt-1"
          >
            Browse all tasks
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <ul className="divide-y divide-line">
          {focusItems.map((task) => {
            const isOverdue =
              task.due_date &&
              !task.completed_at &&
              isPast(parseISO(task.due_date)) &&
              !isToday(parseISO(task.due_date));
            const isDueToday =
              task.due_date && isToday(parseISO(task.due_date));

            return (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {task.title}
                  </span>
                  {task.quest && (
                    <span className="hidden max-w-[140px] shrink-0 truncate text-xs text-ink-muted sm:inline">
                      {task.quest.title}
                    </span>
                  )}
                  {task.due_date && (
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        isOverdue
                          ? 'text-[var(--status-serious)]'
                          : isDueToday
                            ? 'text-[var(--status-warning)]'
                            : 'text-ink-muted'
                      }`}
                    >
                      {format(parseISO(task.due_date), 'MMM d')}
                      {isOverdue && ' · Overdue'}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
