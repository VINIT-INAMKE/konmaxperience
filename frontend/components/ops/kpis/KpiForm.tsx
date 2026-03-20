'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { apiClient } from '@/lib/api-client';
import {
  KPI_DOMAINS,
  KPI_DOMAIN_LABELS,
  KPI_STATUS_LABELS,
  type Kpi,
  type CreateKpiDto,
  type UpdateKpiDto,
  type KpiStatus,
} from '@/lib/types/kpi';

const kpiSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100, 'Name must be at most 100 characters'),
  description: z.string().min(1, 'Description is required'),
  domain: z.string().min(1, 'Domain is required'),
  unit: z.string().min(1, 'Unit is required'),
  target_value: z.coerce.number().min(0, 'Must be a non-negative number'),
  current_value: z.coerce.number().min(0).optional(),
  status: z.enum(['on_track', 'at_risk', 'off_track']).optional(),
  linked_task_ids_raw: z.string().optional(),
});

type KpiFormData = z.infer<typeof kpiSchema>;

interface KpiFormProps {
  kpi?: Kpi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KpiForm({ kpi, open, onOpenChange }: KpiFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!kpi;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<KpiFormData>({
    defaultValues: {
      name: '',
      description: '',
      domain: '',
      unit: '',
      target_value: 0,
      current_value: 0,
      status: 'on_track',
      linked_task_ids_raw: '',
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (kpi) {
      reset({
        name: kpi.name,
        description: kpi.description,
        domain: kpi.domain,
        unit: kpi.unit,
        target_value: kpi.target_value,
        current_value: kpi.current_value,
        status: kpi.status,
        linked_task_ids_raw: kpi.tasks.map((t) => t.id).join('\n'),
      });
    } else {
      reset({
        name: '',
        description: '',
        domain: '',
        unit: '',
        target_value: 0,
        current_value: 0,
        status: 'on_track',
        linked_task_ids_raw: '',
      });
    }
  }, [kpi, reset, open]);

  const mutation = useMutation({
    mutationFn: async (data: KpiFormData) => {
      const linked_task_ids = data.linked_task_ids_raw
        ? data.linked_task_ids_raw
            .split('\n')
            .map((id) => id.trim())
            .filter(Boolean)
        : [];

      if (isEdit && kpi) {
        const body: UpdateKpiDto = {
          name: data.name,
          description: data.description,
          unit: data.unit,
          target_value: data.target_value,
          current_value: data.current_value ?? 0,
          status: data.status as KpiStatus,
          linked_task_ids,
        };
        return apiClient.patch(`/kpis/${kpi.id}`, body);
      } else {
        const body: CreateKpiDto = {
          name: data.name,
          description: data.description,
          unit: data.unit,
          target_value: data.target_value,
          current_value: data.current_value ?? 0,
          status: data.status as KpiStatus,
          domain: data.domain,
          linked_task_ids,
        };
        return apiClient.post('/kpis', body);
      }
    },
    onSuccess: () => {
      toast.success('KPI saved.');
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to save KPI. Check your inputs and try again.');
    },
  });

  function onSubmit(data: KpiFormData) {
    mutation.mutate(data);
  }

  const domainValue = watch('domain');
  const statusValue = watch('status');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit KPI' : 'Create KPI'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="kpi-name">Name</Label>
            <Input
              id="kpi-name"
              placeholder="KPI name"
              {...register('name')}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="kpi-description">Description</Label>
            <Textarea
              id="kpi-description"
              placeholder="What does this KPI measure?"
              {...register('description')}
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Domain */}
          <div className="space-y-1.5">
            <Label>Domain</Label>
            <Select
              value={domainValue}
              onValueChange={(v) => setValue('domain', v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                {KPI_DOMAINS.map((domain) => (
                  <SelectItem key={domain} value={domain}>
                    {KPI_DOMAIN_LABELS[domain]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.domain && (
              <p className="text-xs text-destructive">{errors.domain.message}</p>
            )}
          </div>

          {/* Unit */}
          <div className="space-y-1.5">
            <Label htmlFor="kpi-unit">Unit</Label>
            <Input
              id="kpi-unit"
              placeholder="e.g. percent, count, hours"
              {...register('unit')}
              aria-invalid={!!errors.unit}
            />
            {errors.unit && (
              <p className="text-xs text-destructive">{errors.unit.message}</p>
            )}
          </div>

          {/* Target value */}
          <div className="space-y-1.5">
            <Label htmlFor="kpi-target">Target Value</Label>
            <Input
              id="kpi-target"
              type="number"
              step="any"
              placeholder="100"
              {...register('target_value')}
              aria-invalid={!!errors.target_value}
            />
            {errors.target_value && (
              <p className="text-xs text-destructive">{errors.target_value.message}</p>
            )}
          </div>

          {/* Current value */}
          <div className="space-y-1.5">
            <Label htmlFor="kpi-current">Current Value</Label>
            <Input
              id="kpi-current"
              type="number"
              step="any"
              placeholder="0"
              {...register('current_value')}
              aria-invalid={!!errors.current_value}
            />
            {errors.current_value && (
              <p className="text-xs text-destructive">{errors.current_value.message}</p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={statusValue}
              onValueChange={(v) => setValue('status', v as KpiStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {(['on_track', 'at_risk', 'off_track'] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {KPI_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linked task IDs */}
          <div className="space-y-1.5">
            <Label htmlFor="kpi-tasks">Linked Task IDs</Label>
            <Textarea
              id="kpi-tasks"
              placeholder="Paste task IDs, one per line"
              className="font-mono text-xs"
              {...register('linked_task_ids_raw')}
            />
            <p className="text-xs text-muted-foreground">
              One task ID per line. Full combobox selection coming in v2.
            </p>
          </div>

          {/* Footer actions */}
          <SheetFooter className="px-0 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Discard Changes
            </Button>
            <ShimmerButton
              type="submit"
              disabled={mutation.isPending}
              className="text-sm px-5 py-2"
            >
              {mutation.isPending ? 'Saving...' : 'Save KPI'}
            </ShimmerButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
