'use client';

import { Trash2, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';
import type { WasteLog } from '@/lib/types/kitchen';
import { WasteLogForm } from '@/components/ops/kitchen/waste/WasteLogForm';
import { WasteLogRow } from '@/components/ops/kitchen/waste/WasteLogRow';

export default function WasteLogPage() {
  const queryClient = useQueryClient();

  const { data: entries, isLoading, isError, refetch } = useQuery({
    queryKey: ['waste-log'],
    queryFn: () => apiClient.get<WasteLog[]>('/kitchen/waste'),
  });

  const handleSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['waste-log'] });
  };

  return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Waste Log</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: waste history table */}
          <div className="lg:col-span-2">
            {isLoading && (
              <div className="rounded-lg border divide-y" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </div>
                ))}
              </div>
            )}

            {isError && !isLoading && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Could not load the waste log</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2">
                  Today&apos;s waste entries failed to load.
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!isLoading && !isError && (!entries || entries.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Trash2 className="size-10 text-ink-faint" />
                <h2 className="text-lg font-semibold text-muted-foreground">
                  No waste logged today
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm text-center">
                  Record waste from spoilage, over-prep, or cooking errors to track cost impact.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    document
                      .getElementById('waste-log-form')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >
                  Log waste
                </Button>
              </div>
            )}

            {!isError && entries && entries.length > 0 && (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-muted/40">
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Cost Impact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Logged By
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <WasteLogRow key={entry.id} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: waste log form */}
          <div id="waste-log-form" className="lg:col-span-1">
            <WasteLogForm onSuccess={handleSuccess} />
          </div>
        </div>
      </div>
  );
}
