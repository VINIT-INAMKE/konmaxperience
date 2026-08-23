'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { QuestProgress } from '@/components/ops/quests/QuestProgress';
import { ConfirmActivateDialog } from '@/components/ops/quests/ConfirmActivateDialog';
import { TaskListView } from '@/components/ops/tasks/TaskListView';
import { TaskViewToggle } from '@/components/ops/tasks/TaskViewToggle';

const TaskKanban = dynamic(
  () => import('@/components/ops/tasks/TaskKanban').then((m) => m.TaskKanban),
  { loading: () => <Skeleton className="h-96 rounded-xl" /> },
);
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import { QUEST_STATUS_LABELS } from '@/lib/types/quests';
import type { Quest } from '@/lib/types/quests';
import type { Task, TaskStatus } from '@/lib/types/tasks';
import { TASK_TYPE_XP_WEIGHT } from '@/lib/types/tasks';
import { NumberTicker } from '@/components/ui/number-ticker';
import { STATUS_BADGE } from '@/lib/status-styles';
import { ExportButton } from '@/components/ops/exports/ExportButton';

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'active':
      return STATUS_BADGE.info;
    case 'completed':
      return STATUS_BADGE.good;
    case 'blocked':
      return STATUS_BADGE.critical;
    default:
      return '';
  }
}

export default function QuestDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [activateOpen, setActivateOpen] = useState(false);

  const {
    data: quest,
    isLoading: questLoading,
    isError: questError,
    refetch: refetchQuest,
  } = useQuery({
    queryKey: ['quests', id],
    queryFn: () => apiClient.get<Quest>(`/quests/${id}`),
  });

  const {
    data: tasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['tasks', { questId: id }],
    queryFn: () => apiClient.get<Task[]>(`/tasks?quest_id=${id}`),
    enabled: !!quest,
  });

  const statusMutation = useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: string;
      status: TaskStatus;
    }) => apiClient.patch(`/tasks/${taskId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['tasks', { questId: id }],
      });
      void queryClient.invalidateQueries({ queryKey: ['quests', id] });
    },
  });

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    statusMutation.mutate({ taskId, status: newStatus });
  };

  const handleActivated = () => {
    void queryClient.invalidateQueries({ queryKey: ['quests', id] });
  };

  const deactivateMutation = useMutation({
    mutationFn: () => apiClient.patch(`/quests/${id}`, { status: 'planned' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quests', id] });
    },
  });

  // Count core tasks for activation dialog
  const coreTaskCount = tasks.filter((t) => t.task_type === 'core').length;
  const totalAdhocTasks = tasks.filter((t) => t.task_type === 'adhoc').length;

  // XP summaries from validated tasks
  const totalXpEarned = tasks
    .filter((t) => t.valid)
    .reduce((sum, t) => sum + t.valid_xp, 0);
  const potentialXp = tasks.reduce(
    (sum, t) => sum + Math.floor(t.xp * (TASK_TYPE_XP_WEIGHT[t.task_type] ?? 1)),
    0,
  );

  if (questLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    );
  }

  if (questError || !quest) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Could not load this quest. Try again in a moment.
          </AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={() => void refetchQuest()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        {/* Breadcrumb + header */}
        <div className="space-y-2">
          <Link
            href={`/missions/${quest.mission_id}`}
            className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          >
            <ArrowLeft className="size-3" />
            {quest.mission?.title || 'Mission'}
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{quest.title}</h1>
              <Badge variant="secondary">Week {quest.week_number}</Badge>
              <Badge
                variant="secondary"
                className={getStatusBadgeClass(quest.status)}
              >
                {QUEST_STATUS_LABELS[quest.status]}
              </Badge>
            </div>

            {/* Activate / Deactivate quest button */}
            {quest.status === 'planned' && isAdmin && (
              <Button onClick={() => setActivateOpen(true)}>
                Activate quest
              </Button>
            )}
            {quest.status === 'active' && isAdmin && (
              <Button
                variant="outline"
                onClick={() => {
                  deactivateMutation.mutate();
                }}
                disabled={deactivateMutation.isPending}
              >
                {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate quest'}
              </Button>
            )}
          </div>
        </div>

        {/* Progress section */}
        <div className="max-w-md">
          <QuestProgress
            coreProgress={quest.core_progress_percent}
            adhocProgress={quest.adhoc_progress_percent}
            baselineTaskCount={quest.baseline_task_count}
            totalAdhocTasks={totalAdhocTasks}
          />
          {!tasksLoading && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">XP earned:</span>
              <NumberTicker
                value={totalXpEarned}
                className="text-sm font-semibold text-[var(--status-good)] tabular-nums"
              />
              <span className="text-sm text-muted-foreground">
                / {potentialXp} XP
              </span>
            </div>
          )}
        </div>

        {/* Task view header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Tasks</h2>
            <Badge variant="secondary">{tasks.length}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExportButton reportType="tasks" reportName="Tasks" isTimeSeries={false} />
            <TaskViewToggle view={view} onViewChange={setView} />
            <Button
              nativeButton={false}
              render={<Link href={`/quests/${id}/tasks/new`} />}
            >
              <Plus className="size-4" />
              Add task
            </Button>
            <Button
              variant="outline"
              className="text-[var(--status-warning)] border-[var(--status-warning)]/30 hover:bg-[var(--status-warning)]/10"
              nativeButton={false}
              render={<Link href={`/quests/${id}/tasks/new?type=adhoc`} />}
            >
              <Plus className="size-4" />
              Add ad-hoc task
            </Button>
          </div>
        </div>

        {/* Task view */}
        {tasksLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
          </div>
        ) : tasksError ? (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                Could not load tasks for this quest. Try again in a moment.
              </AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" onClick={() => void refetchTasks()}>
              Retry
            </Button>
          </div>
        ) : view === 'kanban' ? (
          <TaskKanban
            tasks={tasks}
            onStatusChange={handleStatusChange}
            currentUserId={user?.id || ''}
            isAdmin={isAdmin}
          />
        ) : (
          <TaskListView
            tasks={tasks}
            onStatusChange={handleStatusChange}
            currentUserId={user?.id || ''}
            isAdmin={isAdmin}
          />
        )}

        {/* Activate dialog */}
        <ConfirmActivateDialog
          questId={id}
          questTitle={quest.title}
          coreTaskCount={coreTaskCount}
          open={activateOpen}
          onOpenChange={setActivateOpen}
          onActivated={handleActivated}
        />
      </div>
  );
}
