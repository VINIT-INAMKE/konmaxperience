'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient, ApiError } from '@/lib/api-client';
import type { Node, UpdateNodePayload } from '@/lib/types/nodes';
import { NODE_STATUS_BADGE_CLASSES, NODE_STATUS_LABELS } from '@/lib/types/nodes';
import { cn } from '@/lib/utils';

const NODE_KEY = ['nodes', 'current'] as const;

/**
 * Used only where `Intl.supportedValuesOf` is unavailable — the picker must
 * still offer something sane rather than an empty list.
 */
const FALLBACK_TIME_ZONES = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];

function supportedTimeZones(): string[] {
  try {
    const supported = Intl.supportedValuesOf('timeZone');
    if (supported.length > 0) return [...supported];
  } catch {
    // Older runtime — fall through to the short list.
  }
  return FALLBACK_TIME_ZONES;
}

const nodeSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(120, 'Name must be 120 characters or fewer'),
  timezone: z.string().min(1, 'Select a time zone'),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter ISO 4217 code, for example INR'),
});

type NodeFormValues = z.infer<typeof nodeSchema>;

function ReadOnlyRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-xs tracking-wide text-ink-muted uppercase">{term}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

export function NodeSettingsForm() {
  const queryClient = useQueryClient();

  const {
    data: node,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: NODE_KEY,
    queryFn: () => apiClient.get<Node>('/nodes/current'),
  });

  /** The saved zone is always offered, even if the runtime does not list it. */
  const timeZones = useMemo(() => {
    const zones = supportedTimeZones();
    const current = node?.timezone;
    if (current && !zones.includes(current)) {
      return [current, ...zones];
    }
    return zones;
  }, [node]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<NodeFormValues>({
    resolver: zodResolver(nodeSchema),
    defaultValues: { name: '', timezone: '', currency: '' },
    // `values` keeps the form in step with the query without a reset effect.
    values: node
      ? { name: node.name, timezone: node.timezone, currency: node.currency }
      : undefined,
  });

  // `useWatch` rather than the `watch()` returned by `useForm`: the latter hands
  // back a function the React Compiler cannot memoize, which opts the whole
  // component out of compilation.
  const timezone = useWatch({ control, name: 'timezone' });

  const mutation = useMutation({
    mutationFn: (payload: UpdateNodePayload) =>
      apiClient.patch<Node>('/nodes/current', payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(NODE_KEY, updated);
      void queryClient.invalidateQueries({ queryKey: NODE_KEY });
      toast.success('Node settings saved.');
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Could not save node settings.',
      );
    },
  });

  // Browser-level guard for half-finished edits.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  async function onSubmit(values: NodeFormValues) {
    if (!node) return;
    const payload: UpdateNodePayload = {};
    const name = values.name.trim();
    if (name !== node.name) payload.name = name;
    if (values.timezone !== node.timezone) payload.timezone = values.timezone;
    if (values.currency !== node.currency) payload.currency = values.currency;

    if (Object.keys(payload).length === 0) {
      toast.info('Nothing to save.');
      return;
    }
    await mutation.mutateAsync(payload);
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]" aria-busy="true">
        <div className="h-[360px] animate-pulse rounded-xl bg-surface-raised motion-reduce:animate-none" />
        <div className="h-[200px] animate-pulse rounded-xl bg-surface-raised motion-reduce:animate-none" />
      </div>
    );
  }

  if (isError || !node) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-card py-12 text-center ring-1 ring-foreground/10">
        <AlertCircle className="size-8 text-serious" aria-hidden="true" />
        <p className="text-sm text-ink-muted">
          Can&apos;t load the node right now.
        </p>
        <Button variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Node</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="node-name">Name</Label>
              <Input
                id="node-name"
                {...register('name')}
                placeholder="Konma Villa"
                maxLength={120}
                aria-invalid={errors.name ? true : undefined}
              />
              <p className="text-xs text-ink-muted">
                Shown wherever this deployment is named. 1&ndash;120 characters.
              </p>
              {errors.name && (
                <p className="text-xs text-critical" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="node-timezone">Time zone</Label>
              <Combobox
                items={timeZones}
                limit={60}
                value={timezone || null}
                onValueChange={(value: unknown) =>
                  setValue('timezone', (value as string | null) ?? '', {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <ComboboxInput
                  id="node-timezone"
                  placeholder="Search IANA time zones…"
                  className="w-full"
                />
                <ComboboxContent>
                  <ComboboxEmpty>No time zone found.</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxCollection>
                      {(zone: string) => (
                        <ComboboxItem key={zone} value={zone}>
                          <span className="font-mono text-xs">{zone}</span>
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <p className="text-xs text-ink-muted">
                IANA zone id. Drives every &ldquo;today&rdquo; boundary the
                backend computes.
              </p>
              {errors.timezone && (
                <p className="text-xs text-critical" role="alert">
                  {errors.timezone.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="node-currency">Currency</Label>
              <Input
                id="node-currency"
                {...register('currency')}
                onChange={(event) =>
                  setValue('currency', event.target.value.toUpperCase(), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder="INR"
                maxLength={3}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={errors.currency ? true : undefined}
                className="w-28 font-mono tracking-widest uppercase"
              />
              <p className="text-xs text-ink-muted">
                ISO 4217 alphabetic code &mdash; exactly three letters.
              </p>
              {errors.currency && (
                <p className="text-xs text-critical" role="alert">
                  {errors.currency.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-line pt-4">
              <Button type="submit" disabled={!isDirty || mutation.isPending}>
                {mutation.isPending && (
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                Save changes
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!isDirty || mutation.isPending}
                onClick={() =>
                  reset({
                    name: node.name,
                    timezone: node.timezone,
                    currency: node.currency,
                  })
                }
              >
                Discard
              </Button>
              {isDirty && (
                <span className="text-xs text-ink-muted" role="status">
                  Unsaved changes
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Not editable here</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <ReadOnlyRow term="Code">
              <span className="font-mono text-xs">{node.code}</span>
            </ReadOnlyRow>
            <ReadOnlyRow term="Status">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  NODE_STATUS_BADGE_CLASSES[node.status] ??
                    'bg-surface-raised text-ink-muted',
                )}
              >
                {NODE_STATUS_LABELS[node.status] ?? node.status}
              </span>
            </ReadOnlyRow>
            <ReadOnlyRow term="Created">
              <time dateTime={node.created_at}>
                {format(parseISO(node.created_at), 'd MMM yyyy')}
              </time>
            </ReadOnlyRow>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">
            v2.0 runs exactly one node. Code and status change through a
            migration, not this screen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
