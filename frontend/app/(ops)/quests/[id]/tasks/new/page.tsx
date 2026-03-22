'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { TaskForm, type TaskFormValues } from '@/components/ops/tasks/TaskForm';
import { apiClient } from '@/lib/api-client';
import type { Quest } from '@/lib/types/quests';
import type { TaskType, CreateTaskDto } from '@/lib/types/tasks';

export default function NewTaskPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = use(props.params);
  const searchParams = use(props.searchParams);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultTaskType =
    searchParams.type === 'adhoc' ? 'adhoc' : undefined;

  const {
    data: quest,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['quests', id],
    queryFn: () => apiClient.get<Quest>(`/quests/${id}`),
  });

  async function handleSubmit(data: TaskFormValues) {
    if (!quest) return;
    setIsSubmitting(true);
    try {
      const createDto: CreateTaskDto = {
        mission_id: quest.mission_id,
        quest_id: id,
        title: data.title,
        description: data.description,
        task_type: data.task_type as TaskType,
        domain: data.domain,
        owner_user_id: data.owner_user_id,
        priority: data.priority,
        xp: data.xp,
        depends_on_task_id: data.depends_on_task_id || undefined,
        due_date: data.due_date || undefined,
      };
      await apiClient.post('/tasks', createDto);
      void queryClient.invalidateQueries({
        queryKey: ['tasks', { questId: id }],
      });
      router.push(`/quests/${id}`);
    } catch {
      // Error handled by form
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    );
  }

  if (isError || !quest) {
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <Link
            href={`/quests/${id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3" />
            {quest.title}
          </Link>
          <h1 className="text-2xl font-bold">
            {defaultTaskType === 'adhoc' ? 'New ad-hoc task' : 'New task'}
          </h1>
        </div>

        <TaskForm
          questId={id}
          missionId={quest.mission_id}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          defaultTaskType={defaultTaskType as TaskType | undefined}
        />
      </div>
    </BlurFade>
  );
}
