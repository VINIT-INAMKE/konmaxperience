'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Task, TaskType } from '@/lib/types/tasks';
import {
  TASK_TYPE_LABELS,
  TASK_DOMAIN_LABELS,
  TASK_PRIORITY_LABELS,
} from '@/lib/types/tasks';
import type { UserProfile } from '@/lib/types/users';

interface TaskFormProps {
  questId: string;
  missionId: string;
  onSubmit: (data: TaskFormValues) => Promise<void>;
  isSubmitting: boolean;
  defaultTaskType?: TaskType;
}

const taskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(1, 'Description is required'),
  task_type: z.enum(['core', 'adhoc', 'improvement']),
  domain: z.enum([
    'food',
    'art',
    'lifestyle',
    'ops',
    'procurement',
    'bi',
    'talent',
    'tech',
    'design',
  ]),
  owner_user_id: z.string().min(1, 'Select an owner'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  xp: z.number().int().min(0, 'XP must be 0 or more'),
  depends_on_task_id: z.string().optional(),
  due_date: z.string().optional(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

export function TaskForm({
  questId,
  missionId,
  onSubmit,
  isSubmitting,
  defaultTaskType,
}: TaskFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      task_type: defaultTaskType || 'core',
      priority: 'medium',
      domain: 'food',
      owner_user_id: '',
      xp: 25,
      description: '',
      title: '',
    },
  });

  const taskType = watch('task_type');
  const dependsOnTaskId = watch('depends_on_task_id');

  // Fetch users for owner assignment
  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserProfile[]>('/users'),
  });

  // Fetch tasks in same mission for dependency picker
  const {
    data: missionTasks = [],
    isLoading: depsLoading,
    isError: depsError,
    refetch: refetchDeps,
  } = useQuery({
    queryKey: ['tasks', { missionId }],
    queryFn: () => apiClient.get<Task[]>(`/tasks?mission_id=${missionId}`),
    enabled: !!missionId,
  });

  // Build dependency items for combobox
  const depItems = missionTasks
    .filter((t) => t.quest_id === questId || !t.quest_id)
    .map((t) => `${t.title} (${t.status})`);

  const depTaskMap = new Map(
    missionTasks
      .filter((t) => t.quest_id === questId || !t.quest_id)
      .map((t) => [`${t.title} (${t.status})`, t.id]),
  );

  const selectedDepLabel = dependsOnTaskId
    ? missionTasks.find((t) => t.id === dependsOnTaskId)
      ? `${missionTasks.find((t) => t.id === dependsOnTaskId)!.title} (${missionTasks.find((t) => t.id === dependsOnTaskId)!.status})`
      : undefined
    : undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register('title')} placeholder="Task title" />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Task description"
          rows={4}
        />
        {errors.description && (
          <p className="text-xs text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Task type + Domain */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Task type</Label>
          <Select
            value={taskType}
            onValueChange={(val: unknown) =>
              setValue('task_type', val as TaskType)
            }
            disabled={!!defaultTaskType}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(TASK_TYPE_LABELS) as [string, string][]
              ).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {taskType === 'adhoc' && (
            <p className="text-xs text-[var(--status-warning)]">
              Ad-hoc tasks receive 70% XP weight
            </p>
          )}
          {taskType === 'improvement' && (
            <p className="text-xs text-[var(--status-info)]">
              Improvement tasks receive 80% XP weight
            </p>
          )}
          {errors.task_type && (
            <p className="text-xs text-destructive">
              {errors.task_type.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Domain</Label>
          <Select
            value={watch('domain')}
            onValueChange={(val: unknown) =>
              setValue('domain', val as TaskFormValues['domain'])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select domain" />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(TASK_DOMAIN_LABELS) as [string, string][]
              ).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.domain && (
            <p className="text-xs text-destructive">
              {errors.domain.message}
            </p>
          )}
        </div>
      </div>

      {/* Owner + Priority */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Assigned to</Label>
          {usersLoading ? (
            <Skeleton className="h-8 w-full rounded-lg" />
          ) : usersError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Could not load people</AlertTitle>
              <AlertDescription className="flex items-center gap-2">
                <span>The owner list is unavailable right now.</span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => void refetchUsers()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Select
              value={watch('owner_user_id')}
              onValueChange={(val: unknown) =>
                setValue('owner_user_id', val as string)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select owner">
                  {(value: string) => {
                    if (!value) return 'Select owner';
                    return users.find(u => u.id === value)?.name ?? 'Select owner';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {users.length > 0 ? (
                  users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))
                ) : (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No people to assign yet.
                  </p>
                )}
              </SelectContent>
            </Select>
          )}
          {errors.owner_user_id && (
            <p className="text-xs text-destructive">
              {errors.owner_user_id.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select
            value={watch('priority')}
            onValueChange={(val: unknown) =>
              setValue('priority', val as TaskFormValues['priority'])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(TASK_PRIORITY_LABELS) as [string, string][]
              ).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.priority && (
            <p className="text-xs text-destructive">
              {errors.priority.message}
            </p>
          )}
        </div>
      </div>

      {/* XP + Due date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="xp">XP</Label>
          <Input
            id="xp"
            type="number"
            {...register('xp', { valueAsNumber: true })}
            min={0}
          />
          {errors.xp && (
            <p className="text-xs text-destructive">{errors.xp.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="due_date">Due date</Label>
          <Input id="due_date" type="date" {...register('due_date')} />
        </div>
      </div>

      {/* Dependency picker — Combobox from @base-ui/react via components/ui/combobox */}
      <div className="space-y-1.5">
        <Label>Depends on task</Label>
        {depsLoading ? (
          <Skeleton className="h-8 w-full rounded-lg" />
        ) : depsError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not load tasks</AlertTitle>
            <AlertDescription className="flex items-center gap-2">
              <span>Dependencies for this mission are unavailable.</span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => void refetchDeps()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Combobox
            value={selectedDepLabel ?? null}
            onValueChange={(val: unknown) => {
              const label = val as string | null;
              if (label && depTaskMap.has(label)) {
                setValue('depends_on_task_id', depTaskMap.get(label));
              } else {
                setValue('depends_on_task_id', undefined);
              }
            }}
          >
            <ComboboxInput
              placeholder="Search tasks by title..."
              showClear={!!dependsOnTaskId}
            />
            <ComboboxContent>
              <ComboboxEmpty>No tasks found.</ComboboxEmpty>
              <ComboboxList>
                {depItems.map((item) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Creating...
            </>
          ) : taskType === 'adhoc' ? (
            'Create ad-hoc task'
          ) : (
            'Create task'
          )}
        </Button>
      </div>
    </form>
  );
}
