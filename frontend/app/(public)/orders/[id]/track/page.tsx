'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Receipt, ExternalLink } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderTrackingTimeline } from '@/components/public/OrderTrackingTimeline';
import { useCustomerAuth } from '@/hooks/use-customer-auth';
import { useCustomerPusherChannel } from '@/lib/hooks/use-customer-pusher-channel';
import { apiClient } from '@/lib/api-client';
import type { CustomerOrder } from '@/lib/types/marketplace';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface OrderTrackingPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderTrackingPage({ params }: OrderTrackingPageProps) {
  const { id: orderId } = use(params);
  const { customer, fetchProfile } = useCustomerAuth();
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [localDeliveryStatus, setLocalDeliveryStatus] = useState<
    string | null
  >(null);
  const [timestamps, setTimestamps] = useState<Record<string, string>>({});

  // Fetch profile on mount to get customer.id for Pusher channel
  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  // Fetch order details
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['customer-order', orderId],
    queryFn: () =>
      apiClient.get<CustomerOrder>(`/customer/orders/${orderId}`),
    enabled: !!orderId,
  });

  // Set initial timestamps from order's created_at
  useEffect(() => {
    if (order) {
      setTimestamps((prev) => ({
        placed: order.created_at,
        ...prev,
      }));
      setLocalStatus(order.status);
      setLocalDeliveryStatus(order.delivery_status);
    }
  }, [order]);

  // Pusher real-time subscription
  const channelRef = useCustomerPusherChannel(
    customer?.id ? `private-customer-${customer.id}` : null,
  );

  const handleStatusChange = useCallback(
    (data: { orderId: string; status: string; updatedAt: string }) => {
      if (data.orderId === orderId) {
        setLocalStatus(data.status);
        setTimestamps((prev) => ({ ...prev, [data.status]: data.updatedAt }));
      }
    },
    [orderId],
  );

  const handleDeliveryUpdate = useCallback(
    (data: {
      orderId: string;
      deliveryStatus: string;
      updatedAt: string;
    }) => {
      if (data.orderId === orderId) {
        setLocalDeliveryStatus(data.deliveryStatus);
        setTimestamps((prev) => ({
          ...prev,
          [data.deliveryStatus]: data.updatedAt,
        }));
      }
    },
    [orderId],
  );

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    channel.bind('order.status-changed', handleStatusChange);
    channel.bind('delivery.updated', handleDeliveryUpdate);

    return () => {
      channel.unbind('order.status-changed', handleStatusChange);
      channel.unbind('delivery.updated', handleDeliveryUpdate);
    };
  }, [channelRef.current, handleStatusChange, handleDeliveryUpdate]);

  // Determine display values
  const displayStatus = localStatus ?? order?.status ?? 'placed';
  const displayDeliveryStatus =
    localDeliveryStatus ?? order?.delivery_status ?? null;
  const channel: 'takeaway' | 'delivery' =
    order?.channel === 'delivery' ? 'delivery' : 'takeaway';

  const openReceipt = () => {
    window.open(
      `${API_BASE_URL}/customer/orders/${orderId}/receipt`,
      '_blank',
    );
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="mt-6 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="w-4 h-4 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center">
        <p className="text-sm text-[var(--public-muted)]">
          Order not found or you do not have access.
        </p>
      </div>
    );
  }

  const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const channelLabel = channel === 'delivery' ? 'Delivery' : 'Pickup';

  return (
    <BlurFade direction="up">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="text-xl font-semibold text-[var(--public-fg)]">
          Order #{order.order_number}
        </h1>
        <p className="text-sm text-[var(--public-muted)] mt-1">
          {channelLabel} &middot; {formattedDate}
        </p>

        {/* Timeline */}
        <OrderTrackingTimeline
          channel={channel}
          status={displayStatus}
          deliveryStatus={displayDeliveryStatus}
          timestamps={timestamps}
        />

        {/* Order summary card */}
        <div className="mt-6 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--public-fg)]">
            Order Summary
          </h2>

          {/* Items list */}
          <div className="space-y-1">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[var(--public-fg-subtle)]">
                  {item.product.name} x{item.quantity}
                </span>
                <span className="text-[var(--public-fg)] font-medium">
                  {'\u20B9'}
                  {(item.unit_price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--public-border-warm)]" />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--public-fg)]">
              Total
            </span>
            <span className="text-base font-semibold text-[var(--public-fg)]">
              {'\u20B9'}
              {order.total.toFixed(2)}
            </span>
          </div>

          {/* Payment method */}
          {order.payment && (
            <p className="text-xs text-[var(--public-muted)]">
              Paid via {order.payment.method}
              {order.payment.razorpay_payment_id
                ? ` (${order.payment.razorpay_payment_id})`
                : ''}
            </p>
          )}
        </div>

        {/* Receipt link */}
        <button
          type="button"
          onClick={openReceipt}
          className="mt-4 flex items-center gap-1.5 text-sm text-[var(--public-terracotta)] hover:underline"
        >
          <Receipt className="size-4" />
          Download receipt
          <ExternalLink className="size-3" />
        </button>
      </div>
    </BlurFade>
  );
}
