'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { MeterBreakdown } from './MeterBreakdown';
import { MeterHistoryChart } from './MeterHistoryChart';
import { MeterModeBadge } from './MeterModeBadge';
import { METER_TONE_TEXT, meterTone } from './meter-tone';
import type {
  MeterSignal,
  MeterTaskEvent,
  ReadinessMeter,
} from '@/lib/types/readiness';

function ago(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg border border-line bg-surface-raised"
        />
      ))}
    </div>
  );
}

function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** `GET /readiness-meters/:id/tasks` — the validated-task half of the meter. */
function TaskContributions({ meterId }: { meterId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['readiness-meters', meterId, 'tasks'],
    queryFn: () =>
      apiClient.get<MeterTaskEvent[]>(`/readiness-meters/${meterId}/tasks`),
  });

  if (isLoading) return <ListSkeleton />;
  if (isError)
    return (
      <ListError
        message="Failed to load tasks for this meter."
        onRetry={() => refetch()}
      />
    );
  if (!data || data.length === 0)
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        No validated tasks contributing to this meter yet.
      </p>
    );

  return (
    <ul className="space-y-2">
      {data.map((event) => (
        <li
          key={event.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-ink">
              {event.task.title}
            </span>
            <span className="text-xs text-ink-muted">
              {event.task.owner.name} · {ago(event.created_at)}
            </span>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-good">
            +{event.task.valid_xp} XP
          </span>
        </li>
      ))}
    </ul>
  );
}

/** `GET /readiness-meters/:code/signals` — the ops-derived contribution ledger. */
function SignalContributions({ code }: { code: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['readiness-signals', code],
    queryFn: () =>
      apiClient.get<MeterSignal[]>(`/readiness-meters/${code}/signals?limit=20`),
  });

  if (isLoading) return <ListSkeleton />;
  if (isError)
    return (
      <ListError
        message="Failed to load signals for this meter."
        onRetry={() => refetch()}
      />
    );
  if (!data || data.length === 0)
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        No operations signals recorded yet. Signals appear as orders, deliveries
        and recipe changes flow through the bridge.
      </p>
    );

  return (
    <ul className="space-y-2">
      {data.map((signal) => {
        const amount = Number(signal.value);
        return (
          <li
            key={signal.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-mono text-sm font-medium text-ink">
                {signal.source_event}
              </span>
              <span className="truncate text-xs text-ink-muted">
                {signal.source_type}:{signal.source_id.slice(0, 8)} ·{' '}
                {ago(signal.created_at)}
              </span>
            </div>
            <span
              className={cn(
                'shrink-0 text-sm font-semibold tabular-nums',
                Number.isFinite(amount) && amount < 0
                  ? 'text-serious'
                  : 'text-ink-subtle',
              )}
            >
              {Number.isFinite(amount) ? amount.toFixed(2) : signal.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface MeterDetailPanelProps {
  meter: ReadinessMeter;
  onClose: () => void;
}

/**
 * Three stacked blocks — how the value is composed, how it has moved, and what
 * moved it. Which ledger is shown depends on the meter's mode: a `derived` meter
 * has no contributing tasks, a `hybrid` meter has both.
 */
export function MeterDetailPanel({ meter, onClose }: MeterDetailPanelProps) {
  const tone = meterTone(meter.current_value);

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
            {meter.name}
            <span
              className={cn('tabular-nums', METER_TONE_TEXT[tone])}
            >
              {Math.round(meter.current_value)}%
            </span>
            <MeterModeBadge mode={meter.mode} />
          </CardTitle>
          <p className="mt-1 text-sm text-ink-muted">{meter.description}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close detail panel"
        >
          <X className="size-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        <MeterBreakdown meter={meter} />

        <MeterHistoryChart code={meter.code} />

        {meter.mode === 'task_driven' && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">
              Contributing tasks
            </h3>
            <TaskContributions meterId={meter.id} />
          </section>
        )}

        {meter.mode === 'derived' && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Recent signals</h3>
            <SignalContributions code={meter.code} />
          </section>
        )}

        {meter.mode === 'hybrid' && (
          <Tabs defaultValue="tasks">
            <TabsList aria-label="Contribution ledger">
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="signals">Signals</TabsTrigger>
            </TabsList>
            <TabsContent value="tasks" className="pt-3">
              <TaskContributions meterId={meter.id} />
            </TabsContent>
            <TabsContent value="signals" className="pt-3">
              <SignalContributions code={meter.code} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
