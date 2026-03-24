'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { OrderStatusBadge } from '@/components/ops/pos/OrderStatusBadge';
import { PaymentForm } from '@/components/ops/pos/PaymentForm';
import { apiClient } from '@/lib/api-client';
import { ORDER_CHANNEL_LABELS } from '@/lib/types/kds';
import {
  PAYMENT_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
} from '@/lib/types/orders';
import type { Order, OrderStatus } from '@/lib/types/orders';

interface OrderDetailSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
}

const STATUS_STEPS: OrderStatus[] = ['placed', 'preparing', 'ready', 'served'];
const DELIVERY_STATUS_STEPS = ['picked_up', 'in_transit', 'delivered'];
const TERMINAL_STATUSES: OrderStatus[] = ['served', 'dispatched', 'cancelled'];

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function StatusProgression({ order }: { order: Order }) {
  const steps = order.channel === 'delivery'
    ? ['placed', 'preparing', 'ready', 'dispatched'] as OrderStatus[]
    : STATUS_STEPS;

  const currentIdx = steps.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, idx) => {
        const isCompleted = !isCancelled && idx < currentIdx;
        const isActive = !isCancelled && idx === currentIdx;
        const isFuture = isCancelled || idx > currentIdx;

        return (
          <div key={step} className="flex items-center gap-1">
            {idx > 0 && (
              <div
                className={`h-0.5 w-6 ${
                  isCompleted ? 'bg-emerald-500' : 'bg-muted'
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`size-3 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isActive
                      ? 'bg-primary'
                      : 'bg-muted'
                }`}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive
                    ? 'text-foreground'
                    : isFuture
                      ? 'text-muted-foreground'
                      : 'text-emerald-700'
                }`}
              >
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OrderDetailSheet({
  order,
  open,
  onOpenChange,
  onOrderUpdated,
}: OrderDetailSheetProps) {
  const queryClient = useQueryClient();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiClient.patch('/orders/' + order!.id + '/status', {
        status: 'cancelled',
      }),
    onSuccess: () => {
      toast.success('Order cancelled');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowCancelDialog(false);
      onOpenChange(false);
      onOrderUpdated();
    },
    onError: () => {
      toast.error('Could not update order status. Refresh and try again.');
    },
  });

  const advanceStatusMutation = useMutation({
    mutationFn: (nextStatus: string) =>
      apiClient.patch('/orders/' + order!.id + '/status', {
        status: nextStatus,
      }),
    onSuccess: (_data, nextStatus) => {
      toast.success(`Order marked ${nextStatus}`);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      onOrderUpdated();
    },
    onError: () => {
      toast.error('Could not update order status. Refresh and try again.');
    },
  });

  const deliveryMutation = useMutation({
    mutationFn: (nextStatus: string) =>
      apiClient.patch('/orders/' + order!.id + '/delivery', {
        delivery_status: nextStatus,
      }),
    onSuccess: () => {
      toast.success('Delivery status updated');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => {
      toast.error('Could not update order status. Refresh and try again.');
    },
  });

  if (!order) return null;

  const orderShortId = String(order.order_number);
  const canCancel = !TERMINAL_STATUSES.includes(order.status);

  // Compute next order status
  const STATUS_FLOW: Record<string, string> = {
    placed: 'preparing',
    preparing: 'ready',
    ready: order.channel === 'delivery' ? 'dispatched' : 'served',
  };
  const nextOrderStatus = STATUS_FLOW[order.status] ?? null;
  const NEXT_STATUS_LABELS: Record<string, string> = {
    preparing: 'Start Preparing',
    ready: 'Mark Ready',
    served: 'Mark Served',
    dispatched: 'Mark Dispatched',
  };

  // Compute next delivery status
  const currentDeliveryIdx = order.delivery_status
    ? DELIVERY_STATUS_STEPS.indexOf(order.delivery_status)
    : -1;
  const nextDeliveryStatus =
    currentDeliveryIdx < DELIVERY_STATUS_STEPS.length - 1
      ? DELIVERY_STATUS_STEPS[currentDeliveryIdx + 1]
      : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[28px] font-bold font-mono leading-[1.1]">
              #{orderShortId}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Order detail for #{orderShortId}
            </SheetDescription>
            <div className="flex items-center gap-2 flex-wrap">
              <OrderStatusBadge status={order.status} />
              <span className="text-sm text-muted-foreground">
                {ORDER_CHANNEL_LABELS[order.channel]}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatDateTime(order.created_at)}
              </span>
            </div>
          </SheetHeader>

          <div className="px-4 pb-4 space-y-5">
            {/* Items table */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground mb-2">Items</h3>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Item</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Price</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items ?? []).map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{item.menu_item?.name ?? 'Unknown item'}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{formatINR(item.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{formatINR(item.unit_price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div>
              <Separator className="mb-3" />
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold">{formatINR(order.subtotal)}</span>
                </div>
                {order.channel_modifier_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Channel Modifier</span>
                    <span className="font-mono font-bold">
                      {formatINR(order.channel_modifier_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="font-mono">{formatINR(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Channel fields */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground mb-2">Channel Details</h3>
              <div className="space-y-1 text-sm">
                {order.channel === 'dine_in' && order.table_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Table #</span>
                    <span>{order.table_number}</span>
                  </div>
                )}
                {(order.channel === 'takeaway' || order.channel === 'delivery') &&
                  order.customer_phone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span>{order.customer_phone}</span>
                    </div>
                  )}
                {order.channel === 'delivery' && (
                  <>
                    {order.delivery_address && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address</span>
                        <span className="text-right max-w-[240px]">{order.delivery_address}</span>
                      </div>
                    )}
                    {order.delivery_assigned_to && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assigned to</span>
                        <span>{order.delivery_assigned_to}</span>
                      </div>
                    )}
                  </>
                )}
                {order.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notes</span>
                    <span className="text-right max-w-[240px]">{order.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order status progression */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground mb-2">Status</h3>
              <StatusProgression order={order} />
            </div>

            {/* Advance order status */}
            {nextOrderStatus && (
              <Button
                className="w-full"
                onClick={() => advanceStatusMutation.mutate(nextOrderStatus)}
                disabled={advanceStatusMutation.isPending}
              >
                {advanceStatusMutation.isPending
                  ? 'Updating...'
                  : NEXT_STATUS_LABELS[nextOrderStatus] ?? `Move to ${nextOrderStatus}`}
              </Button>
            )}

            {/* Payment section */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground mb-2">Payment</h3>
              {order.payment ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span>{PAYMENT_METHOD_LABELS[order.payment.method]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-mono font-bold">{formatINR(order.payment.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <OrderStatusBadge paymentStatus={order.payment.status} />
                  </div>
                  {order.payment.notes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notes</span>
                      <span className="text-right max-w-[240px]">{order.payment.notes}</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {!showPaymentForm ? (
                    <Button onClick={() => setShowPaymentForm(true)} className="w-full">
                      Record Payment
                    </Button>
                  ) : (
                    <PaymentForm
                      orderId={order.id}
                      orderTotal={order.total}
                      onPaymentRecorded={() => {
                        setShowPaymentForm(false);
                        onOrderUpdated();
                      }}
                    />
                  )}
                </>
              )}
            </div>

            {/* Delivery section */}
            {order.channel === 'delivery' && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground mb-2">Delivery</h3>
                <div className="space-y-2">
                  {order.delivery_assigned_to && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Assigned to</span>
                      <span>{order.delivery_assigned_to}</span>
                    </div>
                  )}
                  {order.delivery_status && (
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Delivery Status</span>
                      <span>{DELIVERY_STATUS_LABELS[order.delivery_status] ?? order.delivery_status}</span>
                    </div>
                  )}
                  {nextDeliveryStatus && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => deliveryMutation.mutate(nextDeliveryStatus)}
                      disabled={deliveryMutation.isPending}
                    >
                      {deliveryMutation.isPending
                        ? 'Updating...'
                        : `Mark ${DELIVERY_STATUS_LABELS[nextDeliveryStatus]}`}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Cancel order */}
            {canCancel && (
              <div className="pt-2">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Cancel Order
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              Order #{orderShortId} will be cancelled. Items on the kitchen display
              will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelMutation.isPending}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
