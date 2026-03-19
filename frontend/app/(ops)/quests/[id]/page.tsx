'use client';

import { use, useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BlurFade } from '@/components/ui/blur-fade';
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';
import { QuestProgress } from '@/components/ops/quests/QuestProgress';
import { ConfirmActivateDialog } from '@/components/ops/quests/ConfirmActivateDialog';
import { TaskKanban } from '@/components/ops/tasks/TaskKanban';
import { TaskListView } from '@/components/ops/tasks/TaskListView';
import { TaskViewToggle } from '@/components/ops/tasks/TaskViewToggle';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import { QUEST_STATUS_LABELS } from '@/lib/types/quests';
import type { Quest } from '@/lib/types/quests';
import type { Task, TaskStatus } from '@/lib/types/tasks';

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'active':
      return 'text-blue-400 bg-blue-950 border-blue-500/20';
    case 'completed':
      return 'text-green-400 bg-green-950 border-green-500/20';
    case 'blocked':
      return 'text-red-400 bg-red-950 border-red-500/20';
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
  const confettiRef = useRef<ConfettiRef>(null);

  const {
    data: quest,
    isLoading: questLoading,
    isError: questError,
  } = useQuery({
    queryKey: ['quests', id],
    queryFn: () => apiClient.get<Quest>(`/quests/${id}`),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
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

  // Count core tasks for activation dialog
  const coreTaskCount = tasks.filter((t) => t.task_type === 'core').length;
  const totalAdhocTasks = tasks.filter((t) => t.task_type === 'adhoc').length;

  // Fire confetti when quest status is completed on load
  if (quest?.status === 'completed') {
    confettiRef.current?.fire({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.5 },
    });
  }

  if (questLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    );
  }

  if (questError || !quest) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
        <AlertCircle className="size-6 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Could not load quest. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <BlurFade>
      <div className="space-y-6">
        {/* Breadcrumb + header */}
        <div className="space-y-2">
          <Link
            href={`/missions/${quest.mission_id}`}
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3" />
            {quest.mission?.title || 'Mission'}
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{quest.title}</h1>
              <Badge variant="secondary">Week {quest.week_number}</Badge>
              <Badge
                variant="secondary"
                className={getStatusBadgeClass(quest.status)}
              >
                {QUEST_STATUS_LABELS[quest.status]}
              </Badge>
            </div>

            {/* Activate quest button */}
            {quest.status === 'planned' && isAdmin && (
              <Button onClick={() => setActivateOpen(true)}>
                Activate quest
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
        </div>

        {/* Task view header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Tasks</h2>
            <Badge variant="secondary">{tasks.length}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <TaskViewToggle view={view} onViewChange={setView} />
            <Button
              render={<Link href={`/quests/${id}/tasks/new`} />}
            >
              <Plus className="size-4" />
              Add task
            </Button>
            <Button
              variant="outline"
              className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
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

        {/* Quest completion confetti */}
        <Confetti
          ref={confettiRef}
          manualstart
          className="pointer-events-none fixed inset-0 z-[200] h-full w-full"
        />
      </div>
    </BlurFade>
  );
}
