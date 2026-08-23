'use client';

import { Fragment, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, isPast, parseISO } from 'date-fns';
import { Link as LinkIcon, AlertTriangle, ClipboardList, Plus, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { AdHocTaskSheet } from './AdHocTaskSheet';
import { MeterChip } from './MeterChip';
import { QuestTaskChip } from './QuestTaskChip';
import type { Task, TaskStatus } from '@/lib/types/tasks';
import {
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_TYPE_XP_WEIGHT,
} from '@/lib/types/tasks';
import {
  getPriorityBadge,
  getTaskStatusBadge,
  getTaskTypeBadge,
} from '@/lib/status-styles';

interface TaskListViewProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  currentUserId: string;
  isAdmin: boolean;
  /**
   * Break the rows into one section per `TaskStatus`. `/quests/[id]` leaves this
   * off — one quest's tasks read fine as a flat sortable table — while `/tasks`
   * turns it on so a cross-quest list still says what stage each row is at.
   */
  groupByStatus?: boolean;
}

type SortField = 'title' | 'status' | 'priority' | 'due_date';
type SortDir = 'asc' | 'desc';

/** Section order when grouping: what needs moving first, retired last. */
const LIST_STATUS_ORDER: TaskStatus[] = [
  'todo',
  'doing',
  'blocked',
  'done',
  'cancelled',
];

/** Columns in the header row — the group heading spans all of them. */
const COLUMN_COUNT = 9;

const priorityOrder: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const getTypeBadgeClass = getTaskTypeBadge;
const getStatusBadgeClass = getTaskStatusBadge;
const getPriorityBadgeClass = getPriorityBadge;

// Statuses available for the Select dropdown (no 'blocked' -- blocking requires reason)
const selectableStatuses: TaskStatus[] = ['todo', 'doing', 'done'];

export function TaskListView({
  tasks,
  onStatusChange,
  currentUserId,
  isAdmin,
  groupByStatus = false,
}: TaskListViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [adHocOpen, setAdHocOpen] = useState(false);

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

  const groups = useMemo(() => {
    if (!groupByStatus) return [];
    const byStatus = new Map<TaskStatus, Task[]>();
    for (const task of filteredAndSorted) {
      const bucket = byStatus.get(task.status);
      if (bucket) bucket.push(task);
      else byStatus.set(task.status, [task]);
    }
    return LIST_STATUS_ORDER.filter((status) => byStatus.has(status)).map(
      (status) => ({ status, rows: byStatus.get(status) as Task[] }),
    );
  }, [filteredAndSorted, groupByStatus]);

  const canChangeStatus = (task: Task) => task.is_own === true || isAdmin;

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '';

  const sortButton = (field: SortField, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      aria-label={`Sort by ${label}`}
      className="inline-flex items-center rounded-sm select-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
    >
      {label}
      {sortIndicator(field)}
    </button>
  );

  const renderRow = (task: Task) => {
    const isOverdue =
      task.due_date && !task.completed_at && isPast(parseISO(task.due_date));
    return (
      <TableRow
        key={task.id}
        className={`cursor-pointer hover:bg-muted/50 ${task.valid ? 'bg-[var(--status-good)]/5' : ''}`}
        onClick={() => router.push(`/tasks/${task.id}`)}
      >
        <TableCell>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate max-w-[200px]">{task.title}</span>
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
            {/* SPEC §6.4 — the meter this row feeds, deep-linked by code. */}
            {task.readiness_meter_id && (
              <div className="flex" onClick={(e) => e.stopPropagation()}>
                <MeterChip
                  meterId={task.readiness_meter_id}
                  meterLabel={task.readiness_meter?.name}
                  value={task.readiness_value}
                />
              </div>
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
        <TableCell className="text-xs text-muted-foreground">
          {task.owner?.name || 'Unassigned'}
        </TableCell>
        <TableCell
          className={`text-xs ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {task.due_date
            ? `${format(parseISO(task.due_date), 'MMM d')}${isOverdue ? ' · Overdue' : ''}`
            : '-'}
        </TableCell>
        {/* Cross-quest lists live here, so the quest is a real link, not a label. */}
        <TableCell
          className="hidden md:table-cell text-xs text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {task.quest ? (
            <QuestTaskChip quest={task.quest} className="max-w-[140px]" />
          ) : (
            <span className="block max-w-[140px] truncate">-</span>
          )}
        </TableCell>
        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
          <span className="truncate max-w-[140px] block">
            {task.quest?.mission?.title ?? task.mission?.title ?? '-'}
          </span>
        </TableCell>
        <TableCell className="text-xs">
          {task.valid ? (
            <span className="text-[var(--status-good)] font-medium">
              {task.valid_xp} XP
            </span>
          ) : (
            <span className="text-muted-foreground">
              +{Math.floor(task.xp * (TASK_TYPE_XP_WEIGHT[task.task_type] ?? 1))} XP
            </span>
          )}
        </TableCell>
        <TableCell>
          {task.blocked && <Badge variant="destructive">Blocked</Badge>}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter tasks by title..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {filteredAndSorted.length === 0 ? (
        filter ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2 text-center">
            <SearchX className="size-6 text-muted-foreground" />
            <h3 className="text-xl font-semibold">No matching tasks</h3>
            <p className="text-sm text-muted-foreground">
              No task title contains &ldquo;{filter}&rdquo;.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setFilter('')}
            >
              Clear filter
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 space-y-2 text-center">
            <ClipboardList className="size-6 text-muted-foreground" />
            <h3 className="text-xl font-semibold">No tasks to show</h3>
            <p className="text-sm text-muted-foreground">
              Add the first task or inject an ad-hoc task to begin tracking work.
            </p>
            <Button size="sm" className="mt-2" onClick={() => setAdHocOpen(true)}>
              <Plus className="size-4" />
              Inject ad-hoc task
            </Button>
          </div>
        )
      ) : (
        <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">
                {sortButton('title', 'Title')}
              </TableHead>
              <TableHead className="w-[10%]">
                {/* Sorting by status is meaningless once the rows are sectioned by it. */}
                {groupByStatus ? 'Status' : sortButton('status', 'Status')}
              </TableHead>
              <TableHead className="w-[10%]">
                {sortButton('priority', 'Priority')}
              </TableHead>
              <TableHead className="w-[12%]">Owner</TableHead>
              <TableHead className="w-[10%]">
                {sortButton('due_date', 'Due Date')}
              </TableHead>
              <TableHead className="hidden md:table-cell w-[12%]">Quest</TableHead>
              <TableHead className="hidden md:table-cell w-[12%]">Mission</TableHead>
              <TableHead className="w-[8%]">XP</TableHead>
              <TableHead className="w-[8%]">Blocked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupByStatus
              ? groups.map(({ status, rows }) => (
                  <Fragment key={status}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={COLUMN_COUNT}
                        className="bg-surface-sunken py-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase"
                      >
                        {TASK_STATUS_LABELS[status]}
                        <span className="ml-2 font-normal tabular-nums normal-case">
                          {rows.length}
                        </span>
                      </TableCell>
                    </TableRow>
                    {rows.map(renderRow)}
                  </Fragment>
                ))
              : filteredAndSorted.map(renderRow)}
          </TableBody>
        </Table>
        </div>
      )}

      <AdHocTaskSheet open={adHocOpen} onOpenChange={setAdHocOpen} />
    </div>
  );
}
