'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MISSION_PHASE_LABELS,
  MISSION_SCOPE_LABELS,
  type CreateMissionDto,
  type MissionPhase,
  type MissionScope,
} from '@/lib/types/missions';

const missionSchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    description: z.string().min(1, 'Description is required'),
    phase: z.enum(['setup', 'foundation', 'activation', 'scale'], {
      message: 'Select a phase',
    }),
    scope: z.enum(['food', 'art', 'lifestyle', 'system', 'mixed'], {
      message: 'Select a scope',
    }),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) > new Date(data.start_date);
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['end_date'],
    },
  );

type MissionFormData = z.infer<typeof missionSchema>;

interface MissionFormProps {
  onSubmit: (data: CreateMissionDto) => Promise<void>;
  isSubmitting: boolean;
  defaultValues?: Partial<CreateMissionDto>;
}

export function MissionForm({
  onSubmit,
  isSubmitting,
  defaultValues,
}: MissionFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<MissionFormData>({
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      phase: defaultValues?.phase,
      scope: defaultValues?.scope,
      start_date: defaultValues?.start_date ?? '',
      end_date: defaultValues?.end_date ?? '',
    },
  });

  async function handleFormSubmit(data: MissionFormData) {
    const dto: CreateMissionDto = {
      title: data.title,
      description: data.description,
      phase: data.phase as MissionPhase,
      scope: data.scope as MissionScope,
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
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="e.g. Foundation Sprint - Food Systems"
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
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          placeholder="Describe the mission objectives and expected outcomes..."
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

      {/* Phase and Scope row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Phase</Label>
          <Select
            defaultValue={defaultValues?.phase}
            onValueChange={(v) => setValue('phase', v as MissionPhase)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full" aria-invalid={!!errors.phase}>
              <SelectValue placeholder="Select phase" />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(MISSION_PHASE_LABELS) as [MissionPhase, string][]
              ).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.phase && (
            <p className="text-xs text-destructive">{errors.phase.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Scope</Label>
          <Select
            defaultValue={defaultValues?.scope}
            onValueChange={(v) => setValue('scope', v as MissionScope)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full" aria-invalid={!!errors.scope}>
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(MISSION_SCOPE_LABELS) as [MissionScope, string][]
              ).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.scope && (
            <p className="text-xs text-destructive">{errors.scope.message}</p>
          )}
        </div>
      </div>

      {/* Dates row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input
            id="start_date"
            type="date"
            disabled={isSubmitting}
            {...register('start_date')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End date</Label>
          <Input
            id="end_date"
            type="date"
            disabled={isSubmitting}
            aria-invalid={!!errors.end_date}
            {...register('end_date')}
          />
          {errors.end_date && (
            <p className="text-xs text-destructive">
              {errors.end_date.message}
            </p>
          )}
        </div>
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            Creating...
          </>
        ) : (
          'Create mission'
        )}
      </Button>
    </form>
  );
}
