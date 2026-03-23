'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Gauge } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ReadinessGrid } from '@/components/ops/readiness/ReadinessGrid';
import { apiClient } from '@/lib/api-client';
import type { ReadinessMeter } from '@/lib/types/readiness';

export default function ReadinessPage() {
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null);

  const {
    data: meters,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['readiness-meters'],
    queryFn: () => apiClient.get<ReadinessMeter[]>('/readiness-meters'),
  });

  const isEmpty = !isLoading && !isError && (!meters || meters.length === 0);

  return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Readiness Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All values derived from validated task completions
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 opacity-30 animate-pulse"
              >
                <div className="size-40 rounded-full bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
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
                Couldn&apos;t load readiness data. Refresh the page or try again in a moment.
              </AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Gauge className="size-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">No Readiness Data</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              No validated tasks yet. Readiness meters update when tasks are validated with approved evidence.
            </p>
          </div>
        )}

        {/* Populated state */}
        {meters && meters.length > 0 && (
          <ReadinessGrid
            meters={meters}
            selectedMeterId={selectedMeterId}
            onSelectMeter={setSelectedMeterId}
          />
        )}
      </div>
  );
}
