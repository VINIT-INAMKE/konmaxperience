'use client';

import { useRouter } from 'next/navigation';
import { GripVertical, Link as LinkIcon, CheckCircle2, FileCheck, FileQuestion, TrendingUp } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CoolMode } from '@/components/ui/cool-mode';
import type { Task } from '@/lib/types/tasks';
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS, TASK_TYPE_XP_WEIGHT } from '@/lib/types/tasks';
import { getTaskTypeBadge, STATUS_BADGE } from '@/lib/status-styles';

interface TaskKanbanCardProps {
  task: Task;
  isDraggable: boolean;
}

const getTypeBadgeClass = getTaskTypeBadge;

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
            <Badge className={STATUS_BADGE.amber}>
              Ad-hoc
            </Badge>
          )}
        </div>

        {/* Owner + due date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
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

        {/* Bottom row: XP + evidence status + readiness impact */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* XP */}
          {task.valid ? (
            <CoolMode>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-green-500" />
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1 text-green-500 border-green-500/30"
                >
                  {task.valid_xp} XP
                </Badge>
              </div>
            </CoolMode>
          ) : (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              +{Math.floor(task.xp * (TASK_TYPE_XP_WEIGHT[task.task_type] ?? 1))} XP
            </Badge>
          )}

          {/* Evidence status indicator */}
          {task.status === 'done' && task.valid && (
            <FileCheck className="size-3.5 text-green-500" />
          )}
          {task.status === 'done' && !task.valid && (
            <span title="Evidence pending">
              <FileQuestion className="size-3.5 text-amber-500" />
            </span>
          )}

          {/* Readiness impact */}
          {task.readiness_value > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 text-blue-500 border-blue-500/30">
              <TrendingUp className="size-2.5 mr-0.5" />
              +{task.readiness_value}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
