'use client';

import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { BlurFade } from '@/components/ui/blur-fade';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  } = useQuery({
    queryKey: ['kitchen-metrics'],
    queryFn: () => apiClient.get<KitchenMetrics>('/kitchen/metrics'),
    refetchInterval: 30_000,
  });

  const {
    data: batches,
    isLoading: batchesLoading,
  } = useQuery({
    queryKey: ['prep-batches', 'active'],
    queryFn: () => apiClient.get<PrepBatch[]>('/kitchen/prep-batches?status=active'),
  });

  return (
    <BlurFade>
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold">Kitchen Dashboard</h1>

        <KitchenMetricsCards metrics={metrics} isLoading={metricsLoading} />

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
                              <span className="text-amber-500">
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
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No active prep batches
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>
    </BlurFade>
  );
}
