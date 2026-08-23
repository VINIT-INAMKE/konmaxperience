'use client';

import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { KitchenMetricsCards } from '@/components/ops/kitchen/KitchenMetricsCards';
import { apiClient } from '@/lib/api-client';
import type { KitchenMetrics } from '@/lib/types/analytics';
import type { PrepBatch } from '@/lib/types/kitchen';

export default function KitchenDashboardPage() {
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['kitchen-metrics'],
    queryFn: () => apiClient.get<KitchenMetrics>('/kitchen/metrics'),
    refetchInterval: 30_000,
  });

  const {
    data: batches,
    isLoading: batchesLoading,
    isError: batchesError,
    refetch: refetchBatches,
  } = useQuery({
    queryKey: ['prep-batches', 'active'],
    queryFn: () => apiClient.get<PrepBatch[]>('/kitchen/prep-batches?status=active'),
  });

  return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold">Kitchen Dashboard</h1>

        <KitchenMetricsCards metrics={metrics} isLoading={metricsLoading} />

        {metricsError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Could not load kitchen metrics</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              Live throughput and zone utilisation are unavailable right now.
              <Button variant="outline" size="sm" onClick={() => void refetchMetrics()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Zone Utilization */}
        {metricsLoading && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">Zone Utilization</h2>
            <Card>
              <div className="p-4 space-y-3" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2 flex-1 rounded-full" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {!metricsLoading && !metricsError && metrics && (metrics.zone_utilization?.length ?? 0) === 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">Zone Utilization</h2>
            <Card>
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <Activity className="size-8 text-ink-faint" />
                <p className="text-sm text-muted-foreground">
                  No zone activity yet today. Orders routed to a kitchen zone show up here.
                </p>
                <Button variant="outline" size="sm" onClick={() => void refetchMetrics()}>
                  Refresh
                </Button>
              </div>
            </Card>
          </section>
        )}

        {metrics && metrics.zone_utilization && metrics.zone_utilization.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">Zone Utilization</h2>
            <Card>
              <div className="p-4 space-y-3">
                {metrics.zone_utilization.map((zone) => (
                  <div key={zone.zone_name} className="flex items-center gap-3">
                    <span className="text-sm w-32 truncate">{zone.zone_name}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(
                            (zone.active_orders / Math.max(...metrics.zone_utilization.map((z) => z.active_orders))) * 100,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono font-bold text-sm w-8 text-right">
                      {zone.active_orders}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-bold">Active Prep Batches</h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipe</TableHead>
                  <TableHead>Qty Remaining</TableHead>
                  <TableHead>Expires At</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : batches && batches.length > 0 ? (
                  batches.map((batch) => {
                    const expiresAt = batch.expires_at ? new Date(batch.expires_at) : null;
                    const hoursUntilExpiry = expiresAt
                      ? (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
                      : null;

                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">
                          {batch.recipe?.name ?? 'Unknown'}
                        </TableCell>
                        <TableCell className="font-mono">
                          {batch.quantity_remaining}
                        </TableCell>
                        <TableCell>
                          {expiresAt ? (
                            hoursUntilExpiry !== null && hoursUntilExpiry <= 2 ? (
                              <span className="text-[var(--status-warning)]">
                                {formatDistanceToNow(expiresAt, { addSuffix: true })}
                              </span>
                            ) : (
                              format(expiresAt, 'MMM d, HH:mm')
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={batch.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {batch.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : batchesError ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8">
                      <Alert variant="destructive">
                        <AlertTriangle className="size-4" />
                        <AlertTitle>Could not load prep batches</AlertTitle>
                        <AlertDescription className="flex flex-col items-start gap-2">
                          The active batch list failed to load.
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void refetchBatches()}
                          >
                            Try again
                          </Button>
                        </AlertDescription>
                      </Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <p className="text-sm text-muted-foreground">
                          No active prep batches right now.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void refetchBatches()}
                        >
                          Refresh
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>
  );
}
