'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackageCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { PickAndPackOrder } from '@/lib/types/kitchen';
import { Skeleton } from '@/components/ui/skeleton';
import { PickAndPackOrderCard } from './PickAndPackOrderCard';

export function PickAndPackBoard() {
  const queryClient = useQueryClient();
  const seenOrderIds = useRef<Set<string>>(new Set());
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  const { data: orders, isLoading } = useQuery({
    queryKey: ['pick-and-pack'],
    queryFn: () => apiClient.get<PickAndPackOrder[]>('/kitchen/pick-and-pack'),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // New order detection
  useEffect(() => {
    if (!orders) return;

    const currentIds = new Set(orders.map((o) => o.id));

    // First load: seed without flashing
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
      const timer = setTimeout(() => {
        setNewOrderIds(new Set());
        seenOrderIds.current = currentIds;
      }, 3000);
      return () => clearTimeout(timer);
    }

    seenOrderIds.current = currentIds;
  }, [orders]);

  // Mark item as picked
  const pickMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiClient.patch(`/kitchen/pick-and-pack/items/${itemId}/picked`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pick-and-pack'] });
    },
    onError: () => {
      toast.error('Failed to mark item as picked. Try again.');
    },
  });

  const handleItemPicked = useCallback(
    (itemId: string) => {
      pickMutation.mutate(itemId);
    },
    [pickMutation],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Empty state
  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <PackageCheck className="size-12 text-muted-foreground/40" />
        <h2 className="text-lg font-semibold text-muted-foreground">Nothing to pack</h2>
        <p className="text-sm text-muted-foreground/70 max-w-sm text-center">
          Non-scratch items will appear here when new orders come in.
        </p>
      </div>
    );
  }

  // Sort by created_at ascending (oldest first)
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <div className="space-y-4">
      {sorted.map((order) => (
        <PickAndPackOrderCard
          key={order.id}
          order={order}
          isNew={newOrderIds.has(order.id)}
          onItemPicked={handleItemPicked}
        />
      ))}
    </div>
  );
}
