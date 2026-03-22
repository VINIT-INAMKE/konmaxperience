'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { DeliveryQueueTable } from '@/components/ops/pos/DeliveryQueueTable';
import { apiClient } from '@/lib/api-client';
import type { Order } from '@/lib/types/orders';

export default function DeliveryQueuePage() {
  const queryClient = useQueryClient();

  const { data: allDeliveryOrders = [], isLoading } = useQuery({
    queryKey: ['orders', 'delivery-queue'],
    queryFn: () => apiClient.get<Order[]>('/orders?channel=delivery'),
    refetchInterval: 15000,
  });

  // Filter active deliveries client-side (small subset)
  const activeOrders = allDeliveryOrders.filter(
    (o) => o.status !== 'cancelled' && o.delivery_status !== 'delivered',
  );

  const handleDeliveryUpdate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['orders', 'delivery-queue'],
    });
  }, [queryClient]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold leading-tight">Delivery Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage active delivery orders, assign riders, and track progress.
        </p>
      </div>

      <DeliveryQueueTable
        orders={activeOrders}
        isLoading={isLoading}
        onDeliveryUpdate={handleDeliveryUpdate}
      />
    </div>
  );
}
