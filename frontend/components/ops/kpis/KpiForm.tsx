'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, X, Search } from 'lucide-react';
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
});

interface TaskOption {
  id: string;
  title: string;
  status: string;
  owner?: { name: string };
  quest?: { title: string };
}

type KpiFormData = z.infer<typeof kpiSchema>;

interface KpiFormProps {
  kpi?: Kpi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KpiForm({ kpi, open, onOpenChange }: KpiFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!kpi;
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskSearch, setTaskSearch] = useState('');

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
    },
  });

  // Fetch tasks for the picker
  const { data: allTasks } = useQuery({
    queryKey: ['tasks-for-kpi'],
    // GET /tasks takes no `limit` param — it was ignored, so drop the pretence.
    // The picker narrows the full list client-side below.
    queryFn: () => apiClient.get<TaskOption[]>('/tasks'),
    enabled: open,
  });

  // Filter tasks by search
  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    if (!taskSearch.trim()) return allTasks;
    const q = taskSearch.toLowerCase();
    return allTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.owner?.name?.toLowerCase().includes(q) ||
        t.quest?.title?.toLowerCase().includes(q),
    );
  }, [allTasks, taskSearch]);

  // Get selected task objects for display
  const selectedTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t) => selectedTaskIds.includes(t.id));
  }, [allTasks, selectedTaskIds]);

  function toggleTask(taskId: string) {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  }

  function removeTask(taskId: string) {
    setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId));
  }

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
      });
      setSelectedTaskIds(kpi.tasks?.map((t) => t.id) ?? []);
    } else {
      reset({
        name: '',
        description: '',
        domain: '',
        unit: '',
        target_value: 0,
        current_value: 0,
        status: 'on_track',
      });
      setSelectedTaskIds([]);
    }
    setTaskSearch('');
  }, [kpi, reset, open]);

  const mutation = useMutation({
    mutationFn: async (data: KpiFormData) => {
      if (isEdit && kpi) {
        const body: UpdateKpiDto = {
          name: data.name,
          description: data.description,
          unit: data.unit,
          target_value: Number(data.target_value),
          current_value: Number(data.current_value ?? 0),
          status: data.status as KpiStatus,
          linked_task_ids: selectedTaskIds,
        };
        return apiClient.patch(`/kpis/${kpi.id}`, body);
      } else {
        const body: CreateKpiDto = {
          name: data.name,
          description: data.description,
          unit: data.unit,
          target_value: Number(data.target_value),
          current_value: Number(data.current_value ?? 0),
          status: data.status as KpiStatus,
          domain: data.domain,
          linked_task_ids: selectedTaskIds,
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

          {/* Linked Tasks */}
          <div className="space-y-1.5">
            <Label>Linked Tasks</Label>

            {/* Selected tasks chips */}
            {selectedTasks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTasks.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {t.title}
                    <button
                      type="button"
                      onClick={() => removeTask(t.id)}
                      className="ml-0.5 rounded-sm hover:bg-primary/20 p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tasks by title, owner, or quest..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>

            {/* Task list */}
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {filteredTasks.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground text-center">
                  {allTasks ? 'No tasks match your search' : 'Loading tasks...'}
                </p>
              ) : (
                filteredTasks.map((t) => {
                  const isSelected = selectedTaskIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTask(t.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b last:border-b-0 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div
                        className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/30'
                        }`}
                      >
                        {isSelected && <Check className="size-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.owner?.name ?? 'Unassigned'}
                          {t.quest ? ` · ${t.quest.title}` : ''}
                          {' · '}
                          {t.status}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? 's' : ''} linked
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
