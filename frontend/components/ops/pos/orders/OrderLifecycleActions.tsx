'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import { ORDER_STATUS_LABELS } from '@/lib/types/kds';
import type { OrderStatus } from '@/lib/types/kds';
import {
  DELIVERY_STATUSES,
  DELIVERY_STATUS_LABELS,
} from '@/lib/types/orders';
import type { DeliveryStatus } from '@/lib/types/orders';
import type { StaffOrderDetail } from './types';

/**
 * A byte-for-byte mirror of `OrdersService.STATUS_TRANSITIONS`.
 *
 * Three lanes leave `ready`, one per fulfilment mode — `served` at the counter,
 * `dispatched` to the in-house rider, `shipped` to the courier — and all three
 * converge on `completed`. `refunded` is written by the refund path and is not
 * reachable from here.
 *
 * The screen offers **only** these moves. The server's `400` for an illegal one
 * lists the legal set in its message, so a race (a KDS ticket advancing under
 * the operator's feet) surfaces the server's own sentence verbatim rather than a
 * guess made here.
 */
export const STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  placed: ['confirmed', 'preparing'],
  confirmed: ['preparing'],
  preparing: ['ready'],
  ready: ['served', 'dispatched', 'shipped'],
  dispatched: ['delivered'],
  shipped: ['delivered'],
  served: ['completed'],
  delivered: ['completed'],
};

/**
 * Mirrors `OrdersService.TERMINAL_STATUSES` — the cancel guard, which is a
 * *different* set from "has no forward transition". `shipped` and `delivered`
 * are deliberately absent: the goods have moved but the order is still open.
 */
const NOT_CANCELLABLE: OrderStatus[] = [
  'served',
  'dispatched',
  'completed',
  'cancelled',
  'refunded',
];

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirm order',
  preparing: 'Start preparing',
  ready: 'Mark ready',
  served: 'Mark served',
  dispatched: 'Mark dispatched',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
  completed: 'Complete order',
};

/**
 * `delivered` is not a cosmetic flag. It funnels through
 * `OrderLifecycleService.onDelivered`, which credits the order's loyalty points,
 * and `OrdersService` emits `order.delivered`, which opens the customer's review
 * gate and feeds the mission bridge. Both are effectively irreversible from this
 * screen, so the move is confirmed rather than fired on a single click.
 */
const CONFIRM_COPY: Partial<Record<OrderStatus, { title: string; body: string }>> =
  {
    delivered: {
      title: 'Mark this order delivered?',
      body:
        'Delivering credits the customer’s loyalty points for this order and fires the review invitation. Neither can be undone from this screen.',
    },
    completed: {
      title: 'Complete this order?',
      body:
        'Completing closes the order for good — it is the one status an order never leaves. Loyalty is credited here as a backstop if the order never passed through “delivered”.',
    },
  };

interface OrderLifecycleActionsProps {
  order: StaffOrderDetail;
  onChanged: () => void;
}

/**
 * `PATCH /orders/:id/status` and `POST /orders/:id/complete`.
 *
 * `completed` goes through the dedicated close-out route rather than the status
 * PATCH: it is idempotent by design (a double-tapped till button is a no-op, not
 * a `400`) and it runs the loyalty backstop for an order that went
 * `ready → served → completed` without ever touching `delivered`.
 */
export function OrderLifecycleActions({
  order,
  onChanged,
}: OrderLifecycleActionsProps) {
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const settle = (message: string) => {
    toast.success(message);
    setServerError(null);
    setPendingStatus(null);
    setConfirmCancel(false);
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    onChanged();
  };

  const fail = (error: unknown, fallback: string) => {
    // The server's `400` names the legal moves; showing our own sentence
    // instead would throw away the only accurate description of the race.
    setServerError(apiErrorMessage(error, fallback));
    setPendingStatus(null);
    setConfirmCancel(false);
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) =>
      apiClient.patch(`/orders/${order.id}/status`, { status }),
    onSuccess: (_data, status) =>
      settle(`Order marked ${ORDER_STATUS_LABELS[status] ?? status}`),
    onError: (error) => fail(error, 'The order status could not be changed.'),
  });

  const completeMutation = useMutation({
    mutationFn: () => apiClient.post(`/orders/${order.id}/complete`, {}),
    onSuccess: () => settle('Order completed'),
    onError: (error) => fail(error, 'The order could not be completed.'),
  });

  const deliveryMutation = useMutation({
    mutationFn: (delivery_status: DeliveryStatus) =>
      apiClient.patch(`/orders/${order.id}/delivery`, { delivery_status }),
    onSuccess: (_data, status) =>
      settle(`Delivery marked ${DELIVERY_STATUS_LABELS[status]}`),
    onError: (error) => fail(error, 'The delivery status could not be changed.'),
  });

  const run = (status: OrderStatus) => {
    setServerError(null);
    if (status === 'completed') {
      completeMutation.mutate();
    } else {
      statusMutation.mutate(status);
    }
  };

  const request = (status: OrderStatus) => {
    if (CONFIRM_COPY[status]) {
      setServerError(null);
      setPendingStatus(status);
      return;
    }
    run(status);
  };

  const nextStatuses = STATUS_TRANSITIONS[order.status] ?? [];
  const canCancel = !NOT_CANCELLABLE.includes(order.status);
  const busy =
    statusMutation.isPending ||
    completeMutation.isPending ||
    deliveryMutation.isPending;

  // The rider lane, which advances independently of the order status.
  const deliveryIndex = order.delivery_status
    ? DELIVERY_STATUSES.indexOf(order.delivery_status)
    : -1;
  const nextDelivery =
    order.channel === 'delivery' && deliveryIndex < DELIVERY_STATUSES.length - 1
      ? DELIVERY_STATUSES[deliveryIndex + 1]
      : null;

  const confirm = pendingStatus ? CONFIRM_COPY[pendingStatus] : null;

  return (
    <section className="space-y-3 rounded-xl border border-line bg-card p-4">
      <h2 className="text-sm font-semibold text-ink">Lifecycle</h2>

      {nextStatuses.length === 0 && !canCancel ? (
        <p className="text-sm text-muted-foreground">
          {ORDER_STATUS_LABELS[order.status]} is the end of the line for this
          order — there is no further move.
        </p>
      ) : null}

      {nextStatuses.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <Button
              key={status}
              size="sm"
              disabled={busy}
              onClick={() => request(status)}
            >
              {busy ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
              ) : null}
              {ACTION_LABELS[status] ?? `Move to ${status}`}
            </Button>
          ))}
        </div>
      ) : null}

      {nextDelivery ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-xs text-muted-foreground">
            Delivery:{' '}
            {order.delivery_status
              ? DELIVERY_STATUS_LABELS[order.delivery_status]
              : 'not started'}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => deliveryMutation.mutate(nextDelivery)}
          >
            Mark {DELIVERY_STATUS_LABELS[nextDelivery]}
          </Button>
        </div>
      ) : null}

      {canCancel ? (
        <div className="border-t border-line pt-3">
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setServerError(null);
              setConfirmCancel(true);
            }}
          >
            Cancel order
          </Button>
        </div>
      ) : null}

      {serverError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>The server refused that move</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Irreversible forward moves */}
      <Dialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.title ?? 'Change status?'}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPendingStatus(null)}
            >
              Not yet
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (pendingStatus) run(pendingStatus);
              }}
            >
              {busy ? 'Working…' : 'Yes, continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel order #{order.order_number}?</DialogTitle>
            <DialogDescription>
              The order is cancelled and its tickets leave the kitchen display.
              Cancelling does <strong>not</strong> move money — use the refund
              panel for that.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmCancel(false)}
            >
              Keep order
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => statusMutation.mutate('cancelled')}
            >
              {busy ? 'Cancelling…' : 'Yes, cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
