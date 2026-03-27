'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { SupplyUsageEntry } from '@/lib/types/kitchen';
import { SupplyUsageForm } from '@/components/ops/kitchen/supply-usage/SupplyUsageForm';
import { SupplyUsageRow } from '@/components/ops/kitchen/supply-usage/SupplyUsageRow';

export default function SupplyUsagePage() {
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useQuery({
    queryKey: ['supply-usage'],
    queryFn: () => apiClient.get<SupplyUsageEntry[]>('/kitchen/supply-usage'),
  });

  const handleSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['supply-usage'] });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Supply Usage</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: usage history */}
        <div className="lg:col-span-2">
          {isLoading && (
            <div className="rounded-lg border overflow-hidden">
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading usage log...</p>
              </div>
            </div>
          )}

          {!isLoading && (!entries || entries.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ClipboardList className="size-10 text-muted-foreground/40" />
              <h2 className="text-lg font-semibold text-muted-foreground">
                No usage logged yet
              </h2>
              <p className="text-sm text-muted-foreground/70 max-w-sm text-center">
                Use the form to record supply usage at the end of each shift.
              </p>
            </div>
          )}

          {entries && entries.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Supply
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <SupplyUsageRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Right: log form */}
        <div className="lg:col-span-1">
          <SupplyUsageForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
