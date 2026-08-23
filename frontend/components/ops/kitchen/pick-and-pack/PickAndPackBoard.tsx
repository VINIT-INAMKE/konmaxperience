'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackageCheck, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { PickAndPackOrder } from '@/lib/types/kitchen';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  POLL_FLOOR_MS,
  useRealtimeChannel,
} from '@/lib/hooks/use-realtime-channel';
import { PickAndPackOrderCard } from './PickAndPackOrderCard';

/** SPEC §6.4: BorderBeam marks an order that arrived in the last minute. */
const NEW_ORDER_WINDOW_MS = 60_000;

const PICK_PACK_QUERY_KEY = ['pick-and-pack'] as const;
/** Module-level so `useRealtimeChannel`'s effect does not resubscribe per render. */
const PICK_PACK_EVENTS = [
  'pickpack.order.new',
  'pickpack.order.updated',
] as const;
const PICK_PACK_INVALIDATE = [PICK_PACK_QUERY_KEY] as const;

export function PickAndPackBoard() {
  const queryClient = useQueryClient();

  // SPEC §6.4: realtime carries the queue; the poll is the ≥ 30 s fallback and
  // is off entirely while the socket is up.
  const { live } = useRealtimeChannel(
    'private-pick-pack',
    PICK_PACK_EVENTS,
    PICK_PACK_INVALIDATE,
  );

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: PICK_PACK_QUERY_KEY,
    queryFn: () => apiClient.get<PickAndPackOrder[]>('/kitchen/pick-and-pack'),
    refetchInterval: live ? false : POLL_FLOOR_MS,
  });

  // An order is "new" while it is under a minute old — recomputed on every poll.
  const newOrderIds = new Set(
    (orders ?? [])
      .filter(
        (order) =>
          Date.now() - new Date(order.created_at).getTime() < NEW_ORDER_WINDOW_MS,
      )
      .map((order) => order.id),
  );

  // Mark item as picked
  const pickMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiClient.patch(`/kitchen/pick-and-pack/items/${itemId}/picked`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PICK_PACK_QUERY_KEY });
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

  // Error state
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>Could not load the pick &amp; pack queue.</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="size-3.5 mr-1.5" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state
  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <PackageCheck className="size-12 text-ink-faint" />
        <h2 className="text-lg font-semibold text-ink-muted">Nothing to pack</h2>
        <p className="text-sm text-ink-muted max-w-sm text-center">
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
