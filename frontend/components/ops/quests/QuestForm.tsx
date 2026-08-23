'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import type { CreateQuestDto } from '@/lib/types/quests';
import type { UserProfile } from '@/lib/types/users';

const questSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(1, 'Description is required'),
  week_number: z.number().int().min(1, 'Week number must be at least 1'),
  owner_user_id: z.string().min(1, 'Select an owner'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export type QuestFormData = z.infer<typeof questSchema>;

interface QuestFormProps {
  missionId: string;
  onSubmit: (data: CreateQuestDto) => Promise<void>;
  isSubmitting: boolean;
  /** Pre-fills the fields — `QuestSheet` passes the quest's current values. */
  initialValues?: Partial<QuestFormData>;
  /** Overrides the submit button's resting label. */
  submitLabel?: string;
  /** Reports `formState.isDirty` so the sheet can confirm before discarding. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function QuestForm({
  missionId,
  onSubmit,
  isSubmitting,
  initialValues,
  submitLabel,
  onDirtyChange,
}: QuestFormProps) {
  const {
    data: users,
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserProfile[]>('/users'),
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<QuestFormData>({
    resolver: zodResolver(questSchema),
    defaultValues: {
      title: '',
      description: '',
      week_number: 1,
      owner_user_id: '',
      start_date: '',
      end_date: '',
      ...initialValues,
    },
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function handleFormSubmit(data: QuestFormData) {
    const dto: CreateQuestDto = {
      mission_id: missionId,
      title: data.title,
      description: data.description,
      week_number: data.week_number,
      owner_user_id: data.owner_user_id,
    };
    if (data.start_date) dto.start_date = data.start_date;
    if (data.end_date) dto.end_date = data.end_date;
    await onSubmit(dto);
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-4"
    >
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="quest-title">Title</Label>
        <Input
          id="quest-title"
          placeholder="e.g. Week 1 - Kitchen Setup"
          disabled={isSubmitting}
          aria-invalid={!!errors.title}
          {...register('title')}
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="quest-description">Description</Label>
        <Textarea
          id="quest-description"
          rows={3}
          placeholder="Describe the quest objectives..."
          disabled={isSubmitting}
          aria-invalid={!!errors.description}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Week number and Owner row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="week_number">
            Week number (relative to mission start)
          </Label>
          <Input
            id="week_number"
            type="number"
            min={1}
            disabled={isSubmitting}
            aria-invalid={!!errors.week_number}
            {...register('week_number', { valueAsNumber: true })}
          />
          {errors.week_number && (
            <p className="text-xs text-destructive">
              {errors.week_number.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Owner</Label>
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
              defaultValue={initialValues?.owner_user_id ?? ''}
              onValueChange={(v) =>
                setValue('owner_user_id', v as string, { shouldDirty: true })
              }
              disabled={isSubmitting}
            >
              <SelectTrigger
                className="w-full"
                aria-invalid={!!errors.owner_user_id}
              >
                <SelectValue placeholder="Select owner">
                  {(value: string) => {
                    if (!value) return 'Select owner';
                    return users?.find(u => u.id === value)?.name ?? 'Select owner';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {users && users.length > 0 ? (
                  users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
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
      </div>

      {/* Dates row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quest-start">Start date</Label>
          <Input
            id="quest-start"
            type="date"
            disabled={isSubmitting}
            {...register('start_date')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quest-end">End date</Label>
          <Input
            id="quest-end"
            type="date"
            disabled={isSubmitting}
            {...register('end_date')}
          />
        </div>
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            Saving...
          </>
        ) : (
          (submitLabel ?? 'Create quest')
        )}
      </Button>
    </form>
  );
}
