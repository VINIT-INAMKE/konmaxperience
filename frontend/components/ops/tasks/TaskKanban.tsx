'use client';

/**
 * Columns group on `Task.status`, which is exactly what `GET /tasks?status=` and
 * the `?status=blocked` dashboard deep links filter on, so the board and the URL
 * can never disagree.
 *
 * `blocked` is both a `TaskStatus` and an independent `Task.blocked` flag: a task
 * can be `doing` *and* blocked. The flag is never a column — `TaskKanbanCard`
 * renders it as a badge and a left border, so a blocked-but-in-progress task
 * stays in the column that says what stage it is at.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ClipboardList, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TaskKanbanCard } from './TaskKanbanCard';
import { AdHocTaskSheet } from './AdHocTaskSheet';
import type { Task, TaskStatus } from '@/lib/types/tasks';
import { KANBAN_COLUMNS, TASK_STATUS_LABELS } from '@/lib/types/tasks';

interface TaskKanbanProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  currentUserId: string;
  isAdmin: boolean;
  /**
   * Show each card's quest underneath it. On `/quests/[id]` every card shares one
   * quest, so it stays off; `/tasks` is cross-quest and turns it on.
   */
  showQuestLink?: boolean;
}

function getColumnHeaderColor(status: TaskStatus) {
  switch (status) {
    case 'todo':
      return 'text-muted-foreground';
    case 'doing':
      return 'text-[var(--status-info)]';
    case 'done':
      return 'text-[var(--status-good)]';
    case 'blocked':
      return 'text-[var(--status-critical)]';
    case 'cancelled':
      return 'text-ink-faint';
    default:
      return '';
  }
}

/**
 * `cancelled` is a real `TaskStatus` but not a workflow stage, so it only earns a
 * column when the current filter actually produced cancelled rows — which is what
 * makes `/tasks?status=cancelled` render something instead of an empty board.
 */
/** Every id a column droppable can carry, whether or not it is on screen. */
const ALL_COLUMN_IDS: TaskStatus[] = [...KANBAN_COLUMNS, 'cancelled'];

function resolveColumns(tasks: Task[]): TaskStatus[] {
  const extra = KANBAN_COLUMNS.includes('cancelled')
    ? []
    : tasks.some((task) => task.status === 'cancelled')
      ? (['cancelled'] as TaskStatus[])
      : [];
  return [...KANBAN_COLUMNS, ...extra];
}

function SortableCard({
  task,
  isDraggable,
  showQuestLink,
}: {
  task: Task;
  isDraggable: boolean;
  showQuestLink: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !isDraggable,
    data: { task },
  });

  const style: React.CSSProperties = isDragging
    ? { opacity: 0.3, transition }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      <TaskKanbanCard task={task} isDraggable={isDraggable} />
      {showQuestLink && task.quest && (
        // `stopPropagation` on pointer-down so following the link never starts a drag.
        <Link
          href={`/quests/${task.quest.id}`}
          onPointerDown={(event) => event.stopPropagation()}
          className="mt-1 block truncate rounded-sm px-1 text-[11px] text-ink-muted transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        >
          {task.quest.title}
        </Link>
      )}
    </div>
  );
}

export function TaskKanban({
  tasks,
  onStatusChange,
  currentUserId,
  isAdmin,
  showQuestLink = false,
}: TaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [adHocOpen, setAdHocOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const columns = resolveColumns(tasks);

  const tasksByColumn = columns.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>,
  );

  const canDrag = useCallback(
    (task: Task) => task.is_own === true || isAdmin,
    [isAdmin],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      if (task) setActiveTask(task);
    },
    [tasks],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Determine target column from where it was dropped
      let targetColumn: TaskStatus | null = null;

      // Check if dropped on a column droppable
      if (ALL_COLUMN_IDS.includes(over.id as TaskStatus)) {
        targetColumn = over.id as TaskStatus;
      } else {
        // Dropped on a task - find which column that task is in
        const overTask = tasks.find((t) => t.id === over.id);
        if (overTask) {
          targetColumn = overTask.status;
        }
      }

      if (!targetColumn || targetColumn === task.status) return;

      // Blocking needs a reason and cancelling needs intent, so neither is
      // reachable by drag — `BlockerDialog` and the task detail page own them.
      if (targetColumn === 'blocked' || targetColumn === 'cancelled') return;

      onStatusChange(taskId, targetColumn);
    },
    [tasks, onStatusChange],
  );

  if (tasks.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ClipboardList className="size-6 text-muted-foreground" />
          <h3 className="text-base font-semibold">No tasks on this board yet</h3>
          <p className="text-sm text-muted-foreground">
            Tasks you add will appear here and move across the workflow columns.
          </p>
          <Button size="sm" className="mt-2" onClick={() => setAdHocOpen(true)}>
            <Plus className="size-4" />
            Inject ad-hoc task
          </Button>
        </div>
        <AdHocTaskSheet open={adHocOpen} onOpenChange={setAdHocOpen} />
      </>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
      <div className="flex gap-3 sm:gap-4 min-h-[50vh] lg:h-[calc(100vh-280px)]">
        {columns.map((status) => {
          const columnTasks = tasksByColumn[status] || [];
          return (
            <SortableContext
              key={status}
              id={status}
              items={columnTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                status={status}
                tasks={columnTasks}
                canDrag={canDrag}
                showQuestLink={showQuestLink}
              />
            </SortableContext>
          );
        })}
      </div>
      </div>

      <DragOverlay adjustScale={false} dropAnimation={null}>
        {activeTask ? (
          <div className="shadow-lg opacity-90 pointer-events-none">
            <TaskKanbanCard task={activeTask} isDraggable={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  tasks,
  canDrag,
  showQuestLink,
}: {
  status: TaskStatus;
  tasks: Task[];
  canDrag: (task: Task) => boolean;
  showQuestLink: boolean;
}) {
  const { setNodeRef } = useSortable({
    id: status,
    data: { type: 'column', status },
    disabled: true,
  });

  return (
    <div
      ref={setNodeRef}
      className="bg-muted/30 rounded-lg p-2 flex flex-col min-w-[16rem] flex-1 shrink-0"
      role="region"
      aria-label={`${TASK_STATUS_LABELS[status]} column, ${tasks.length} tasks`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
        <span
          className={`text-sm font-medium ${getColumnHeaderColor(status)}`}
        >
          {TASK_STATUS_LABELS[status]}
        </span>
        <Badge variant="secondary" className="text-xs h-5 px-1.5">
          {tasks.length}
        </Badge>
      </div>

      {/* Tasks */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-2 p-1">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <ClipboardList className="size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No tasks</p>
            </div>
          ) : (
            tasks.map((task) => (
              <SortableCard
                key={task.id}
                task={task}
                isDraggable={canDrag(task)}
                showQuestLink={showQuestLink}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
