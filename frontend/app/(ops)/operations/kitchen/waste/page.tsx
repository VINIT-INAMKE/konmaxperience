'use client';

import { Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BlurFade } from '@/components/ui/blur-fade';
import { AnimatedList } from '@/components/ui/animated-list';
import { apiClient } from '@/lib/api-client';
import type { WasteLog } from '@/lib/types/kitchen';
import { WasteLogForm } from '@/components/ops/kitchen/waste/WasteLogForm';
import { WasteLogRow } from '@/components/ops/kitchen/waste/WasteLogRow';

export default function WasteLogPage() {
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery({
    queryKey: ['waste-log'],
    queryFn: () => apiClient.get<WasteLog[]>('/kitchen/waste'),
  });

  const handleSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['waste-log'] });
  };

  return (
    <BlurFade>
      <div className="space-y-8">
        <h1 className="text-xl font-semibold">Waste Log</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: waste history table */}
          <div className="lg:col-span-2">
            {isLoading && (
              <div className="rounded-lg border overflow-hidden">
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">Loading waste log...</p>
                </div>
              </div>
            )}

            {!isLoading && (!entries || entries.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Trash2 className="size-10 text-muted-foreground/40" />
                <h2 className="text-lg font-semibold text-muted-foreground">
                  No waste logged today
                </h2>
                <p className="text-sm text-muted-foreground/70 max-w-sm text-center">
                  Record waste from spoilage, over-prep, or cooking errors to track cost impact.
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
                    <AnimatedList delay={150}>
                      {entries.map((entry) => (
                        <WasteLogRow key={entry.id} entry={entry} />
                      ))}
                    </AnimatedList>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: waste log form */}
          <div className="lg:col-span-1">
            <WasteLogForm onSuccess={handleSuccess} />
          </div>
        </div>
      </div>
    </BlurFade>
  );
}
