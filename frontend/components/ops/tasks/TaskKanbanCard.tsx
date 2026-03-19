'use client';

import { useRouter } from 'next/navigation';
import { GripVertical, Link as LinkIcon } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Task } from '@/lib/types/tasks';
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/lib/types/tasks';

interface TaskKanbanCardProps {
  task: Task;
  isDraggable: boolean;
}

function getTypeBadgeClass(type: string) {
  switch (type) {
    case 'adhoc':
      return 'text-amber-400 bg-amber-950 border-amber-500/20';
    case 'improvement':
      return 'text-blue-400 bg-blue-950 border-blue-500/20';
    default:
      return '';
  }
}

function getPriorityBadgeClass(priority: string) {
  switch (priority) {
    case 'critical':
      return 'text-red-400 bg-red-950 border-red-500/20';
    case 'high':
      return 'text-orange-400 bg-orange-950 border-orange-500/20';
    case 'low':
      return 'text-muted-foreground bg-muted';
    default:
      return '';
  }
}

function getLeftBorderClass(task: Task) {
  if (task.task_type === 'adhoc') return 'border-l-2 border-l-amber-500';
  if (task.blocked) return 'border-l-4 border-l-destructive';
  if (task.status === 'done') return 'border-l-[3px] border-l-green-500';
  return '';
}

export function TaskKanbanCard({ task, isDraggable }: TaskKanbanCardProps) {
  const router = useRouter();

  const isOverdue =
    task.due_date && !task.completed_at && isPast(parseISO(task.due_date));

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:bg-muted/50 ${getLeftBorderClass(task)} ${
        task.status === 'done' ? 'opacity-60' : ''
      }`}
      onClick={() => router.push(`/tasks/${task.id}`)}
    >
      <CardContent className="py-3 px-4 space-y-2">
        {/* Header: title + drag handle */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight line-clamp-2">
            {task.title}
          </h4>
          {isDraggable && (
            <GripVertical className="size-5 text-muted-foreground shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className={getTypeBadgeClass(task.task_type)}>
            {TASK_TYPE_LABELS[task.task_type]}
          </Badge>
          <Badge variant="secondary" className={getPriorityBadgeClass(task.priority)}>
            {TASK_PRIORITY_LABELS[task.priority]}
          </Badge>
          {task.blocked && (
            <Badge variant="destructive">
              Blocked
            </Badge>
          )}
          {task.task_type === 'adhoc' && (
            <Badge className="text-amber-400 bg-amber-950 border-amber-500/20">
              Ad-hoc
            </Badge>
          )}
        </div>

        {/* Owner + due date */}
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span className="truncate">{task.owner?.name || 'Unassigned'}</span>
          {task.due_date && (
            <span className={isOverdue ? 'text-destructive' : ''}>
              {format(parseISO(task.due_date), 'MMM d')}
              {isOverdue && ' \u00b7 Overdue'}
            </span>
          )}
        </div>

        {/* Dependency indicator */}
        {task.depends_on && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <LinkIcon className="size-3" />
            <span className="truncate">
              Depends on: {task.depends_on.title}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
