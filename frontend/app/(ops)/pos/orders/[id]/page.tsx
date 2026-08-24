'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiClient, apiErrorStatus } from '@/lib/api-client';
import { SETTING_DEFAULTS } from '@/lib/types/settings';
import type { LoyaltySetting } from '@/lib/types/settings';
import type { Refund } from '@/lib/types/refunds';
import { OrderDetailHeader } from '@/components/ops/pos/orders/OrderDetailHeader';
import {
  OrderLineTable,
  hasShippedLines,
} from '@/components/ops/pos/orders/OrderLineTable';
import { OrderLifecycleActions } from '@/components/ops/pos/orders/OrderLifecycleActions';
import { OrderPaymentPanel } from '@/components/ops/pos/orders/OrderPaymentPanel';
import { OrderRefundPanel } from '@/components/ops/pos/orders/OrderRefundPanel';
import { OrderReceiptButton } from '@/components/ops/pos/orders/OrderReceiptButton';
import { OrderShipmentPanel } from '@/components/ops/pos/orders/OrderShipmentPanel';
import { OrderTimelinePanel } from '@/components/ops/pos/orders/OrderTimelinePanel';
import type { StaffOrderDetail } from '@/components/ops/pos/orders/types';

/**
 * `OPS-05` — the staff order detail route (P5b decision 8).
 *
 * This is a **route**, not a sheet: `/pos/orders/[id]` under the ops group, so
 * `/orders/*` stays free for the customer's own order pages. It replaces the old
 * order-detail sheet under `components/ops/pos/`, which is deleted with this
 * change, and carries forward everything that sheet could do — record a payment,
 * advance the status, advance the delivery leg, cancel — while adding the refund
 * ledger, the shipment link and the money breakdown the sheet never had.
 */
export default function StaffOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['orders', id],
    queryFn: () => apiClient.get<StaffOrderDetail>(`/orders/${id}`),
  });

  /**
   * `settings.loyalty` gates on `MANAGE_SYSTEM`, which the `MANAGE_POS` staff
   * who live on this screen do not have. The read is therefore best-effort and
   * never retried: a manager gets the node's real redemption rate, everyone else
   * gets the packaged default, and neither sees an error for a number that only
   * splits one display line in two.
   */
  const { data: loyaltySetting } = useQuery({
    queryKey: ['settings', 'loyalty'],
    queryFn: () => apiClient.get<LoyaltySetting>('/settings/loyalty'),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const redeemValuePerPoint =
    loyaltySetting?.redeem_value_per_point ??
    SETTING_DEFAULTS.loyalty.redeem_value_per_point;

  // The timeline needs the ledger the refund panel already owns; one key, one
  // fetch, two readers.
  const { data: refunds } = useQuery({
    queryKey: ['orders', id, 'refunds'],
    queryFn: () => apiClient.get<Refund[]>(`/orders/${id}/refunds`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders', id] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    );
  }

  if (isError || !order) {
    const notFound = apiErrorStatus(error) === 404;
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>
            {notFound ? 'No such order' : 'Could not load this order'}
          </AlertTitle>
          <AlertDescription>
            {notFound
              ? 'That order id does not exist. It may have been opened from a stale link.'
              : 'The order failed to load. Try again in a moment.'}
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          {!notFound ? (
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          ) : null}
          <Button
            nativeButton={false}
            render={<Link href="/pos/orders" />}
            variant="outline"
            size="sm"
          >
            Back to order history
          </Button>
        </div>
      </div>
    );
  }

  const shipped = hasShippedLines(order.items);

  return (
    <div className="space-y-6 pb-10">
      <OrderDetailHeader
        order={order}
        redeemValuePerPoint={redeemValuePerPoint}
      />

      <div className="flex flex-wrap gap-2">
        <OrderReceiptButton
          order={order}
          redeemValuePerPoint={redeemValuePerPoint}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <OrderLineTable items={order.items} />
          <OrderRefundPanel order={order} />
        </div>

        <div className="space-y-6">
          <OrderLifecycleActions order={order} onChanged={invalidate} />
          <OrderPaymentPanel order={order} onChanged={invalidate} />
          {shipped ? <OrderShipmentPanel orderId={order.id} /> : null}
          <OrderTimelinePanel
            order={order}
            refunds={refunds ?? []}
            hasShipment={shipped}
          />
        </div>
      </div>
    </div>
  );
}
