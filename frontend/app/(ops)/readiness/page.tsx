'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { AlertCircle, Gauge, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ReadinessGrid } from '@/components/ops/readiness/ReadinessGrid';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { cn } from '@/lib/utils';
import { RoleCode } from '@/lib/types/roles';
import type {
  MeterRecomputeResult,
  ReadinessMeter,
} from '@/lib/types/readiness';

/** The most recent formula run across every derived/hybrid meter. */
function lastComputed(meters: ReadinessMeter[] | undefined): string | null {
  if (!meters) return null;
  const stamps = meters
    .map((m) => m.last_computed_at)
    .filter((v): v is string => Boolean(v))
    .sort();
  const newest = stamps[stamps.length - 1];
  if (!newest) return null;
  try {
    return formatDistanceToNow(parseISO(newest), { addSuffix: true });
  } catch {
    return null;
  }
}

/** Eight meter rings, the shape the grid settles into. */
function ReadinessSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col items-center gap-2 opacity-40 motion-reduce:animate-none"
        >
          <div className="size-40 rounded-full bg-surface-raised" />
          <div className="h-4 w-24 rounded bg-surface-raised" />
          <div className="h-5 w-20 rounded-full bg-surface-raised" />
        </div>
      ))}
    </div>
  );
}

function ReadinessContent() {
  /**
   * SPEC §6.4 — the meter chip deep-links `?meter=CODE`, so the code opens that
   * meter's detail on arrival. `undefined` means "nobody has clicked yet", which
   * is what lets a click close the URL-opened meter instead of it snapping back.
   */
  const searchParams = useSearchParams();
  const meterCodeParam = searchParams.get('meter');
  const [clickedMeterId, setClickedMeterId] = useState<string | null | undefined>(
    undefined,
  );
  const queryClient = useQueryClient();
  const roleCode = useAuthStore((s) => s.user?.roleCode);
  const canRecompute =
    roleCode === RoleCode.FOUNDER_ADMIN || roleCode === RoleCode.TECH_LEAD;

  const {
    data: meters,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['readiness-meters'],
    queryFn: () => apiClient.get<ReadinessMeter[]>('/readiness-meters'),
  });

  const recompute = useMutation({
    mutationFn: () =>
      apiClient.post<MeterRecomputeResult[]>('/readiness-meters/recompute', {}),
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['readiness-meters'] });
      queryClient.invalidateQueries({ queryKey: ['readiness-history'] });
      queryClient.invalidateQueries({ queryKey: ['readiness-signals'] });
      toast.success(
        `Recomputed ${results.length} meter${results.length === 1 ? '' : 's'}`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Recompute failed');
    },
  });

  const isEmpty = !isLoading && !isError && (!meters || meters.length === 0);
  const computedAgo = lastComputed(meters);

  const meterFromUrl =
    meterCodeParam && meters
      ? (meters.find((m) => m.code === meterCodeParam)?.id ?? null)
      : null;
  const selectedMeterId =
    clickedMeterId === undefined ? meterFromUrl : clickedMeterId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Readiness Intelligence
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Validated tasks and live operations data, blended into one number per
            meter.
            {computedAgo ? (
              <>
                {' '}
                Formulas last ran{' '}
                <span className="text-ink-subtle">{computedAgo}</span>.
              </>
            ) : null}
          </p>
        </div>

        {canRecompute && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
          >
            <RefreshCw
              className={cn('size-4', recompute.isPending && 'animate-spin')}
            />
            {recompute.isPending ? 'Recomputing…' : 'Recompute now'}
          </Button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && <ReadinessSkeleton />}

      {/* Error state */}
      {isError && (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Couldn&apos;t load readiness data. Refresh the page or try again in
              a moment.
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center space-y-3 py-16 text-center">
          <Gauge className="size-12 text-ink-faint" />
          <h2 className="text-lg font-semibold text-ink">No readiness data</h2>
          <p className="max-w-md text-sm text-ink-muted">
            No meters are configured for this node yet. Meters appear once the
            reference seed has run.
          </p>
        </div>
      )}

      {/* Populated state */}
      {meters && meters.length > 0 && (
        <ReadinessGrid
          meters={meters}
          selectedMeterId={selectedMeterId}
          onSelectMeter={setClickedMeterId}
        />
      )}
    </div>
  );
}

export default function ReadinessPage() {
  // `useSearchParams()` needs a Suspense boundary above it to prerender.
  return (
    <Suspense fallback={<ReadinessSkeleton />}>
      <ReadinessContent />
    </Suspense>
  );
}
