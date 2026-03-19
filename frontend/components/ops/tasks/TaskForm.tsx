'use client';

import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import { Loader2 } from 'lucide-react';
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

export interface TaskFormValues {
  title: string;
  description: string;
  task_type: 'core' | 'adhoc' | 'improvement';
  domain: 'food' | 'art' | 'lifestyle' | 'ops' | 'procurement' | 'bi' | 'talent' | 'tech' | 'design';
  owner_user_id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  xp: number;
  depends_on_task_id?: string;
  due_date?: string;
}

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
    defaultValues: {
      task_type: defaultTaskType || 'core',
      priority: 'medium',
      xp: 25,
      description: '',
    },
  });

  const taskType = watch('task_type');
  const dependsOnTaskId = watch('depends_on_task_id');

  // Fetch users for owner assignment
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserProfile[]>('/users'),
  });

  // Fetch tasks in same mission for dependency picker
  const { data: missionTasks = [] } = useQuery({
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
      <div className="grid grid-cols-2 gap-4">
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
            <p className="text-xs text-amber-500">
              Ad-hoc tasks receive 70% XP weight
            </p>
          )}
          {taskType === 'improvement' && (
            <p className="text-xs text-blue-500">
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Assigned to</Label>
          <Select
            value={watch('owner_user_id')}
            onValueChange={(val: unknown) =>
              setValue('owner_user_id', val as string)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      <div className="grid grid-cols-2 gap-4">
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

      {/* Dependency picker using @reui/p-combobox-3 pattern (Combobox from base-ui via shadcn) */}
      <div className="space-y-1.5">
        <Label>Depends on task</Label>
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
