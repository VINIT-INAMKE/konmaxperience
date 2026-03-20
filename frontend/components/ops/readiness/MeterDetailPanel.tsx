'use client';

import { useQuery } from '@tanstack/react-query';
import { X, AlertCircle } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { AnimatedList, AnimatedListItem } from '@/components/ui/animated-list';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';
import type { MeterTaskEvent } from '@/lib/types/readiness';

interface MeterDetailPanelProps {
  meterId: string;
  meterName: string;
  currentValue: number;
  onClose: () => void;
}

export function MeterDetailPanel({
  meterId,
  meterName,
  currentValue,
  onClose,
}: MeterDetailPanelProps) {
  const {
    data: tasks,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['readiness-meters', meterId, 'tasks'],
    queryFn: () =>
      apiClient.get<MeterTaskEvent[]>(`/readiness-meters/${meterId}/tasks`),
  });

  return (
    <BlurFade className="col-span-full">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {meterName} — {Math.round(currentValue)}% Ready
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close detail panel"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                Failed to load tasks for this meter.
              </AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && tasks && tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No validated tasks contributing to this meter yet.
          </p>
        )}

        {/* Task list */}
        {!isLoading && !isError && tasks && tasks.length > 0 && (
          <AnimatedList delay={50} className="items-stretch gap-2">
            {tasks.map((event) => (
              <AnimatedListItem key={event.id}>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-card">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {event.task.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {event.task.owner.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-green-500 ml-3 shrink-0">
                    +{event.task.valid_xp} XP
                  </span>
                </div>
              </AnimatedListItem>
            ))}
          </AnimatedList>
        )}
      </Card>
    </BlurFade>
  );
}
