'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { OrderMoneySummary } from '@/components/storefront/track/OrderMoneySummary';
import {
  BookingGroup,
  LocalGroup,
  PendingShipmentGroup,
} from '@/components/storefront/track/OrderTimeline';
import { ShipmentTracker } from '@/components/storefront/track/ShipmentTracker';
import { TrackHeader } from '@/components/storefront/track/TrackHeader';
import {
  groupOrderItems,
  isTrackingSettled,
  type TrackOrder,
} from '@/components/storefront/track/track-model';
import { useCart } from '@/hooks/use-cart';
import { apiClient, apiErrorMessage, apiErrorStatus } from '@/lib/api-client';
import { getCustomerPusherClient } from '@/lib/customer-pusher-client';
import { isPusherConfigured } from '@/lib/pusher-client';
import type { CustomerShipment, LoyaltySummary } from '@/lib/types/checkout';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * `IA-07`'s polling floor. Only used while the realtime channel is not live —
 * a subscribed page refetches on the event instead and makes no timed request.
 */
const POLL_MS = 30_000;

/** Pusher payloads that mean "this order moved". Both carry an `orderId`. */
interface OrderScopedEvent {
  orderId?: string;
}

/**
 * The live half of `/orders/[id]/track` (`STORE-03`).
 *
 * ## Two queries, and the second one is allowed to be `null`
 *
 * `GET /customer/orders/:id` is the order. `GET /customer/orders/:id/shipment`
 * answers **`null`, not `404`**, when the order has no `Shipment` row — the
 * single most common shape bug on this screen. `null` is a normal answer with
 * two distinct meanings, and the render below tells them apart by looking at
 * the *lines*: no shipped line means there is no parcel to show at all; a
 * shipped line with no shipment row means the parcel is not booked yet.
 *
 * ## Live, with a poll underneath it
 *
 * Updates arrive on `private-customer-{customerId}` — a **third** auth
 * endpoint, `POST /customer-auth/pusher-auth`, which is neither `/realtime/auth`
 * nor `/chat/auth`; `lib/customer-pusher-client.ts` is the client that knows
 * that, and this page keeps that mechanism unchanged from v1.
 *
 * The subscription can fail for reasons the customer cannot see — no Pusher
 * credentials in the build, an expired `customer_token`, a `403` from the auth
 * route — and a tracking page that silently stops updating is worse than one
 * that refreshes on a timer. So `refetchInterval` runs at 30 s until
 * `pusher:subscription_succeeded` fires, and resumes if the channel errors.
 * Once the order *and* its parcel are terminal, both stop: there is nothing
 * left to poll for.
 */
export interface TrackClientProps {
  orderId: string;
  /** From `?placed=1` on the checkout hand-off — acknowledges the payment. */
  justPlaced?: boolean;
}

export function TrackClient({ orderId, justPlaced = false }: TrackClientProps) {
  const queryClient = useQueryClient();
  const { customer, isSessionLoading } = useCart();
  const customerId = customer?.id ?? null;

  /**
   * Which customer the realtime channel is currently live for, rather than a
   * bare boolean: a sign-out changes `customerId` and the indicator goes false
   * on its own, with no state written from a cleanup function.
   */
  const [liveFor, setLiveFor] = useState<string | null>(null);
  const live = customerId !== null && liveFor === customerId;

  const orderQuery = useQuery({
    queryKey: ['customer-order', orderId],
    queryFn: () => apiClient.get<TrackOrder>(`/customer/orders/${orderId}`),
    retry: (count, error) => apiErrorStatus(error) === null && count < 2,
  });

  const shipmentQuery = useQuery({
    queryKey: ['customer-order-shipment', orderId],
    queryFn: () =>
      apiClient.get<CustomerShipment | null>(`/customer/orders/${orderId}/shipment`),
    // Nothing to look up until we know the order is ours.
    enabled: Boolean(orderQuery.data),
    retry: (count, error) => apiErrorStatus(error) === null && count < 2,
  });

  const order = orderQuery.data ?? null;
  const shipment = shipmentQuery.data ?? null;

  /**
   * The rupee value of a redeemed point, needed to split `discount_amount` back
   * into its coupon and loyalty halves (P5a decision 23). Only fetched when the
   * order actually burned points — otherwise there is nothing to split.
   */
  const loyaltyQuery = useQuery({
    queryKey: ['customer-loyalty'],
    queryFn: () => apiClient.get<LoyaltySummary>('/customer/loyalty'),
    enabled: Boolean(order && order.loyalty_points_redeemed > 0),
    staleTime: 5 * 60_000,
  });

  const settled = order ? isTrackingSettled(order, shipment) : false;
  const pollInterval = !live && !settled ? POLL_MS : false;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['customer-order', orderId] });
    void queryClient.invalidateQueries({ queryKey: ['customer-order-shipment', orderId] });
  }, [queryClient, orderId]);

  // --- realtime -------------------------------------------------------------

  useEffect(() => {
    if (!customerId || !isPusherConfigured()) return;

    let pusher: ReturnType<typeof getCustomerPusherClient>;
    try {
      pusher = getCustomerPusherClient();
    } catch {
      // No browser, or a client that refused to construct. The poll covers it.
      return;
    }

    const channelName = `private-customer-${customerId}`;
    const channel = pusher.subscribe(channelName);

    const onSubscribed = () => setLiveFor(customerId);
    const onSubscriptionError = () => setLiveFor(null);
    const onOrderEvent = (payload: OrderScopedEvent) => {
      // The channel carries every order this customer has; only ours matters.
      if (!payload?.orderId || payload.orderId === orderId) refresh();
    };

    channel.bind('pusher:subscription_succeeded', onSubscribed);
    channel.bind('pusher:subscription_error', onSubscriptionError);
    channel.bind('shipment.updated', onOrderEvent);
    channel.bind('order.status-changed', onOrderEvent);
    channel.bind('delivery.updated', onOrderEvent);

    return () => {
      channel.unbind('pusher:subscription_succeeded', onSubscribed);
      channel.unbind('pusher:subscription_error', onSubscriptionError);
      channel.unbind('shipment.updated', onOrderEvent);
      channel.unbind('order.status-changed', onOrderEvent);
      channel.unbind('delivery.updated', onOrderEvent);
      pusher.unsubscribe(channelName);
    };
  }, [customerId, orderId, refresh]);

  // --- polling --------------------------------------------------------------

  useEffect(() => {
    if (pollInterval === false) return;
    const timer = window.setInterval(refresh, pollInterval);
    return () => window.clearInterval(timer);
  }, [pollInterval, refresh]);

  // --- states ---------------------------------------------------------------

  if (orderQuery.isPending || isSessionLoading) {
    return (
      <div className="space-y-6">
        <StorefrontSkeleton variant="text" count={2} className="max-w-sm" />
        <StorefrontSkeleton variant="list" count={4} />
      </div>
    );
  }

  if (orderQuery.error || !order) {
    const status = apiErrorStatus(orderQuery.error);

    if (status === 401) {
      return (
        <StorefrontEmpty
          title="Sign in to track this order"
          description="Orders are tied to the phone number they were placed with, so we need to know it is you."
          action={{ label: 'Sign in', href: '/login' }}
          secondaryAction={{ label: 'Back to the shop', href: '/shop' }}
        />
      );
    }

    if (status === 403 || status === 404) {
      return (
        <StorefrontEmpty
          title="We could not find that order"
          description="It may belong to a different account, or the link may be mistyped."
          action={{ label: 'Your orders', href: '/account/orders' }}
          secondaryAction={{ label: 'Back to the shop', href: '/shop' }}
        />
      );
    }

    return (
      <StorefrontError
        title="We could not load this order"
        description={apiErrorMessage(orderQuery.error, 'Please try again in a moment.')}
        onRetry={() => void orderQuery.refetch()}
        href="/account/orders"
        actionLabel="Your orders"
      />
    );
  }

  const groups = groupOrderItems(order.items);
  const receiptUrl = `${API_BASE_URL}/customer/orders/${order.id}/receipt`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <TrackHeader
        order={order}
        live={live}
        receiptUrl={receiptUrl}
        justPlaced={justPlaced}
      />

      {groups.local.length ? <LocalGroup order={order} items={groups.local} /> : null}

      {groups.shipped.length ? (
        shipment ? (
          <ShipmentTracker shipment={shipment} items={groups.shipped} />
        ) : (
          <PendingShipmentGroup items={groups.shipped} />
        )
      ) : null}

      {groups.booking.length ? <BookingGroup order={order} items={groups.booking} /> : null}

      <OrderMoneySummary
        order={order}
        redeemValuePerPoint={loyaltyQuery.data?.redeem_value_per_point ?? null}
      />
    </div>
  );
}
