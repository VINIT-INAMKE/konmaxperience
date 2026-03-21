'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PrepBatch } from '@/lib/types/kitchen';
import { PrepBatchRow } from './PrepBatchRow';

export function PrepBatchList() {
  const { data: batches, isLoading, isError } = useQuery({
    queryKey: ['prep-batches'],
    queryFn: () => apiClient.get<PrepBatch[]>('/kitchen/prep-batches'),
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading prep batches...</div>
    );
  }

  if (isError) {
    return (
      <div className="text-sm text-destructive">
        Failed to load data. Refresh the page or try again.
      </div>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm font-medium text-foreground">No active prep batches</p>
        <p className="text-sm text-muted-foreground">
          Start a batch to track prep levels and enable menu availability. Tap New Batch to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recipe
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Qty Remaining
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Qty Produced
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Unit
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Expires In
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <PrepBatchRow key={batch.id} batch={batch} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
