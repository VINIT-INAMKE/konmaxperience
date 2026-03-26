'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { isToday, isPast, parseISO, format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
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
}

const priorityOrder: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function TodaysFocusSection({ allTasks }: TodaysFocusSectionProps) {
  const user = useAuthStore((s) => s.user);

  const focusItems = useMemo(() => {
    if (!allTasks || !user) return [];

    const myTasks = allTasks.filter(
      (t) => t.owner_user_id === user.id && t.status !== 'done' && t.status !== 'cancelled',
    );

    const overdue = myTasks.filter(
      (t) => t.due_date && isPast(parseISO(t.due_date)) && !t.completed_at && !isToday(parseISO(t.due_date)),
    );

    const dueToday = myTasks.filter(
      (t) => t.due_date && isToday(parseISO(t.due_date)) && !t.completed_at,
    );

    const questTasks = myTasks
      .filter(
        (t) =>
          t.quest_id &&
          !overdue.includes(t) &&
          !dueToday.includes(t),
      )
      .sort((a, b) => (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0));

    return [...overdue, ...dueToday, ...questTasks].slice(0, 5);
  }, [allTasks, user]);

  if (focusItems.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-4">
        <span className="text-sm font-bold">Today&apos;s Focus</span>
        <div className="space-y-2 mt-3">
          {focusItems.map((task) => {
            const isOverdue =
              task.due_date &&
              !task.completed_at &&
              isPast(parseISO(task.due_date)) &&
              !isToday(parseISO(task.due_date));
            const isDueToday =
              task.due_date && isToday(parseISO(task.due_date));

            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
              >
                <span className="flex-1 text-sm truncate">{task.title}</span>
                {task.quest && (
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {task.quest.title}
                  </span>
                )}
                {task.due_date && (
                  <span
                    className={`text-xs shrink-0 ${
                      isOverdue
                        ? 'text-destructive'
                        : isDueToday
                          ? 'text-amber-500'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {format(parseISO(task.due_date), 'MMM d')}
                    {isOverdue && ' \u00b7 Overdue'}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
