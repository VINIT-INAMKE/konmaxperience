'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Monitor, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { KdsZoneData, OrderItemStatus } from '@/lib/types/kds';
import { ORDER_ITEM_STATUS_LABELS } from '@/lib/types/kds';
import { KdsZoneColumn } from './KdsZoneColumn';

/** SPEC §6.4: BorderBeam marks an order that arrived in the last minute. */
const NEW_ORDER_WINDOW_MS = 60_000;

export function KdsBoard() {
  const queryClient = useQueryClient();

  const { data: zones, isError, isLoading, refetch } = useQuery({
    queryKey: ['kds-orders'],
    queryFn: () => apiClient.get<KdsZoneData[]>('/kitchen/kds'),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // An order is "new" while it is under a minute old — recomputed on every poll.
  const newOrderIds = new Set(
    (zones ?? [])
      .flatMap((zone) => zone.orders)
      .filter(
        (order) =>
          Date.now() - new Date(order.created_at).getTime() < NEW_ORDER_WINDOW_MS,
      )
      .map((order) => order.id),
  );

  // Status advance mutation
  const statusMutation = useMutation({
    mutationFn: ({ itemId, newStatus }: { itemId: string; newStatus: OrderItemStatus; itemName: string }) =>
      apiClient.patch(`/kitchen/kds/items/${itemId}/status`, { status: newStatus }),
    onSuccess: (_data, variables) => {
      toast.success(`${variables.itemName} \u2014 ${ORDER_ITEM_STATUS_LABELS[variables.newStatus]}`);
      void queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    },
    onError: () => {
      toast.error('Failed to update status. Try again.');
    },
  });

  const handleStatusAdvance = useCallback(
    (itemId: string, newStatus: OrderItemStatus) => {
      // Find the item name from zones data
      let itemName = 'Item';
      if (zones) {
        for (const zone of zones) {
          for (const order of zone.orders) {
            const found = (order.items ?? []).find((i) => i.id === itemId);
            if (found) {
              itemName = found.product_name;
              break;
            }
          }
        }
      }
      statusMutation.mutate({ itemId, newStatus, itemName });
    },
    [zones, statusMutation],
  );

  // Loading state — only on initial load
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-ink-muted text-lg">Loading kitchen orders...</div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <div className="fixed top-16 left-0 right-0 z-[60] bg-critical text-critical-ink text-center py-2 text-sm">
          Connection issue &mdash; retrying...
        </div>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="text-ink-muted text-lg">Reconnecting...</div>
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="size-4 mr-2" />
            Retry now
          </Button>
        </div>
      </>
    );
  }

  // Empty state
  const hasOrders = zones && zones.some((z) => z.orders.length > 0);
  if (!hasOrders) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Monitor className="size-12 text-ink-faint" />
        <h2 className="text-xl font-semibold text-ink-subtle">No orders in queue</h2>
        <p className="text-sm text-ink-muted">
          Orders placed on POS will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 h-full">
      {zones?.map((zone) => (
        <KdsZoneColumn
          key={zone.zone_id}
          zone={zone}
          newOrderIds={newOrderIds}
          onStatusAdvance={handleStatusAdvance}
        />
      ))}
    </div>
  );
}
