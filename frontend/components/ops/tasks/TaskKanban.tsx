'use client';

import { useState, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskKanbanCard } from './TaskKanbanCard';
import type { Task, TaskStatus } from '@/lib/types/tasks';
import { KANBAN_COLUMNS, TASK_STATUS_LABELS } from '@/lib/types/tasks';

interface TaskKanbanProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  currentUserId: string;
  isAdmin: boolean;
}

function getColumnHeaderColor(status: TaskStatus) {
  switch (status) {
    case 'todo':
      return 'text-muted-foreground';
    case 'doing':
      return 'text-blue-400';
    case 'done':
      return 'text-green-400';
    case 'blocked':
      return 'text-red-400';
    default:
      return '';
  }
}

function SortableCard({
  task,
  isDraggable,
}: {
  task: Task;
  isDraggable: boolean;
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group"
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      <TaskKanbanCard task={task} isDraggable={isDraggable} />
    </div>
  );
}

export function TaskKanban({
  tasks,
  onStatusChange,
  currentUserId,
  isAdmin,
}: TaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const tasksByColumn = KANBAN_COLUMNS.reduce(
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
      if (KANBAN_COLUMNS.includes(over.id as TaskStatus)) {
        targetColumn = over.id as TaskStatus;
      } else {
        // Dropped on a task - find which column that task is in
        const overTask = tasks.find((t) => t.id === over.id);
        if (overTask) {
          targetColumn = overTask.status;
        }
      }

      if (!targetColumn || targetColumn === task.status) return;

      // Do NOT allow dragging TO blocked column
      if (targetColumn === 'blocked') return;

      onStatusChange(taskId, targetColumn);
    },
    [tasks, onStatusChange],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-280px)]">
        {KANBAN_COLUMNS.map((status) => {
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
              />
            </SortableContext>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="shadow-lg scale-[1.02] opacity-90">
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
}: {
  status: TaskStatus;
  tasks: Task[];
  canDrag: (task: Task) => boolean;
}) {
  const { setNodeRef } = useSortable({
    id: status,
    data: { type: 'column', status },
    disabled: true,
  });

  return (
    <div
      ref={setNodeRef}
      className="bg-muted/30 rounded-lg p-2 flex flex-col"
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
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2 p-1">
          {tasks.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-8">
              No tasks
            </p>
          ) : (
            tasks.map((task) => (
              <SortableCard
                key={task.id}
                task={task}
                isDraggable={canDrag(task)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
