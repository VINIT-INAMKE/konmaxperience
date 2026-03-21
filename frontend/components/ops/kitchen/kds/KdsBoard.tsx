'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Monitor } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { KdsZoneData, OrderItemStatus } from '@/lib/types/kds';
import { ORDER_ITEM_STATUS_LABELS } from '@/lib/types/kds';
import { KdsZoneColumn } from './KdsZoneColumn';

export function KdsBoard() {
  const queryClient = useQueryClient();
  const seenOrderIds = useRef<Set<string>>(new Set());
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  const { data: zones, isError, isLoading } = useQuery({
    queryKey: ['kds-orders'],
    queryFn: () => apiClient.get<KdsZoneData[]>('/kitchen/kds'),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // New order detection: track seen IDs, compute new ones
  useEffect(() => {
    if (!zones) return;

    const currentIds = new Set<string>();
    for (const zone of zones) {
      for (const order of zone.orders) {
        currentIds.add(order.id);
      }
    }

    // First load: seed seenOrderIds without flashing
    if (seenOrderIds.current.size === 0) {
      seenOrderIds.current = currentIds;
      return;
    }

    const newIds = new Set<string>();
    for (const id of currentIds) {
      if (!seenOrderIds.current.has(id)) {
        newIds.add(id);
      }
    }

    if (newIds.size > 0) {
      setNewOrderIds(newIds);
      // After 3s, clear new flags and update seen
      const timer = setTimeout(() => {
        setNewOrderIds(new Set());
        seenOrderIds.current = currentIds;
      }, 3000);
      return () => clearTimeout(timer);
    }

    seenOrderIds.current = currentIds;
  }, [zones]);

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
            const found = order.items.find((i) => i.id === itemId);
            if (found) {
              itemName = found.menu_item_name;
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
        <div className="text-white/50 text-lg">Loading kitchen orders...</div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <div className="fixed top-16 left-0 right-0 z-[60] bg-destructive/90 text-white text-center py-2 text-sm">
          Connection issue &mdash; retrying...
        </div>
        <div className="flex items-center justify-center h-full">
          <div className="text-white/50 text-lg">Reconnecting...</div>
        </div>
      </>
    );
  }

  // Empty state
  const hasOrders = zones && zones.some((z) => z.orders.length > 0);
  if (!hasOrders) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Monitor className="size-12 text-white/20" />
        <h2 className="text-xl font-semibold text-white/70">No orders in queue</h2>
        <p className="text-sm text-white/40">
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
