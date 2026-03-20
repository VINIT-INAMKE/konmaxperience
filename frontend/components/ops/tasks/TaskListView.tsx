'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, isPast, parseISO } from 'date-fns';
import { Link as LinkIcon, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BlurFade } from '@/components/ui/blur-fade';
import type { Task, TaskStatus } from '@/lib/types/tasks';
import {
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_TYPE_XP_WEIGHT,
} from '@/lib/types/tasks';

interface TaskListViewProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  currentUserId: string;
  isAdmin: boolean;
}

type SortField = 'title' | 'status' | 'priority' | 'due_date';
type SortDir = 'asc' | 'desc';

const priorityOrder: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

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

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'doing':
      return 'text-blue-400 bg-blue-950 border-blue-500/20';
    case 'done':
      return 'text-green-400 bg-green-950 border-green-500/20';
    case 'blocked':
      return 'text-red-400 bg-red-950 border-red-500/20';
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

// Statuses available for the Select dropdown (no 'blocked' -- blocking requires reason)
const selectableStatuses: TaskStatus[] = ['todo', 'doing', 'done'];

export function TaskListView({
  tasks,
  onStatusChange,
  currentUserId,
  isAdmin,
}: TaskListViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let filtered = tasks;
    if (filter) {
      const lower = filter.toLowerCase();
      filtered = tasks.filter((t) => t.title.toLowerCase().includes(lower));
    }

    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'title':
          return dir * a.title.localeCompare(b.title);
        case 'status': {
          const statusOrder = ['todo', 'doing', 'done', 'blocked', 'cancelled'];
          return dir * (statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
        }
        case 'priority':
          return dir * ((priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0));
        case 'due_date': {
          const aDate = a.due_date ? new Date(a.due_date).getTime() : 0;
          const bDate = b.due_date ? new Date(b.due_date).getTime() : 0;
          return dir * (aDate - bDate);
        }
        default:
          return 0;
      }
    });
  }, [tasks, filter, sortField, sortDir]);

  const canChangeStatus = (task: Task) => task.is_own === true || isAdmin;

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '';

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter tasks by title..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {filteredAndSorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-2 text-center">
          <h3 className="text-xl font-semibold">No tasks in this quest</h3>
          <p className="text-sm text-muted-foreground">
            Add the first task or inject an ad-hoc task to begin tracking work.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none w-[35%]"
                onClick={() => toggleSort('title')}
              >
                Title{sortIndicator('title')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-[12%]"
                onClick={() => toggleSort('status')}
              >
                Status{sortIndicator('status')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-[12%]"
                onClick={() => toggleSort('priority')}
              >
                Priority{sortIndicator('priority')}
              </TableHead>
              <TableHead className="w-[15%]">Owner</TableHead>
              <TableHead
                className="cursor-pointer select-none w-[14%]"
                onClick={() => toggleSort('due_date')}
              >
                Due Date{sortIndicator('due_date')}
              </TableHead>
              <TableHead className="w-[10%]">XP</TableHead>
              <TableHead className="w-[10%]">Blocked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {filteredAndSorted.map((task, index) => {
                const isOverdue =
                  task.due_date &&
                  !task.completed_at &&
                  isPast(parseISO(task.due_date));
                return (
                    <TableRow
                      key={task.id}
                      className={`cursor-pointer hover:bg-muted/50 ${task.valid ? 'bg-green-500/5' : ''}`}
                      onClick={() => router.push(`/tasks/${task.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">
                            {task.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className={getTypeBadgeClass(task.task_type)}
                          >
                            {TASK_TYPE_LABELS[task.task_type]}
                          </Badge>
                          {task.depends_on && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <LinkIcon className="size-3" />
                              {task.depends_on.status !== 'done' && (
                                <AlertTriangle className="size-3 text-destructive" />
                              )}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {canChangeStatus(task) ? (
                          <Select
                            value={task.status}
                            onValueChange={(val: unknown) =>
                              onStatusChange(task.id, val as TaskStatus)
                            }
                          >
                            <SelectTrigger className="h-7 w-24" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {selectableStatuses.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {TASK_STATUS_LABELS[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant="secondary"
                            className={getStatusBadgeClass(task.status)}
                          >
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getPriorityBadgeClass(task.priority)}
                        >
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">
                        {task.owner?.name || 'Unassigned'}
                      </TableCell>
                      <TableCell
                        className={`text-[13px] ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}
                      >
                        {task.due_date
                          ? `${format(parseISO(task.due_date), 'MMM d')}${isOverdue ? ' \u00b7 Overdue' : ''}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-[13px]">
                        {task.valid ? (
                          <span className="text-green-500 font-medium">
                            {task.valid_xp} XP
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            +{Math.floor(task.xp * (TASK_TYPE_XP_WEIGHT[task.task_type] ?? 1))} XP
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.blocked && (
                          <Badge variant="destructive">Blocked</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                );
              })}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  );
}
