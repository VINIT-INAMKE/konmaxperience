'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Truck, UserPlus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { apiClient } from '@/lib/api-client';
import type { Order, UpdateDeliveryPayload } from '@/lib/types/orders';
import { DELIVERY_STATUS_LABELS } from '@/lib/types/orders';

interface DeliveryQueueTableProps {
  orders: Order[];
  isLoading: boolean;
  onDeliveryUpdate: () => void;
}

function getNextDeliveryStatus(
  current: string | null,
): 'picked_up' | 'in_transit' | 'delivered' | null {
  if (!current) return 'picked_up';
  if (current === 'picked_up') return 'in_transit';
  if (current === 'in_transit') return 'delivered';
  return null;
}

function getNextStatusLabel(current: string | null): string {
  if (!current) return 'Mark Picked Up';
  if (current === 'picked_up') return 'Mark In Transit';
  if (current === 'in_transit') return 'Mark Delivered';
  return '';
}

function DeliveryStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="text-sm text-muted-foreground">Awaiting pickup</span>
    );
  }

  const label = DELIVERY_STATUS_LABELS[status] || status;

  const variant =
    status === 'delivered'
      ? 'default'
      : status === 'in_transit'
        ? 'secondary'
        : 'outline';

  return <Badge variant={variant}>{label}</Badge>;
}

function AssignPopover({
  orderId,
  onDeliveryUpdate,
}: {
  orderId: string;
  onDeliveryUpdate: () => void;
}) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: (assignName: string) =>
      apiClient.patch<Order>(`/orders/${orderId}/delivery`, {
        delivery_assigned_to: assignName,
      } satisfies UpdateDeliveryPayload),
    onSuccess: () => {
      setOpen(false);
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['orders', 'delivery-queue'] });
      onDeliveryUpdate();
    },
    onError: () => {
      toast.error('Could not assign delivery. Refresh and try again.');
    },
  });

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    assignMutation.mutate(trimmed);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button variant="outline" size="sm" className="gap-1">
          <UserPlus className="size-3.5" />
          Assign
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Rider or staff name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || assignMutation.isPending}
          >
            {assignMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DeliveryQueueTable({
  orders,
  isLoading,
  onDeliveryUpdate,
}: DeliveryQueueTableProps) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: 'picked_up' | 'in_transit' | 'delivered';
    }) =>
      apiClient.patch<Order>(`/orders/${orderId}/delivery`, {
        delivery_status: status,
      } satisfies UpdateDeliveryPayload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders', 'delivery-queue'] });
      onDeliveryUpdate();
    },
    onError: () => {
      toast.error('Could not update order status. Refresh and try again.');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        Loading deliveries...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-16 text-center space-y-1">
        <Truck className="size-10 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="text-base font-semibold">No active deliveries</h3>
        <p className="text-sm text-muted-foreground">
          Delivery orders in progress will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order #</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Delivery Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const nextStatus = getNextDeliveryStatus(order.delivery_status);
          const nextLabel = getNextStatusLabel(order.delivery_status);
          const shortId = `#${order.order_number}`;
          const customer =
            order.customer_name || order.customer_phone || '\u2014';
          const address = order.delivery_address || '\u2014';
          const truncatedAddress =
            address.length > 40 ? `${address.slice(0, 40)}...` : address;

          return (
            <TableRow key={order.id}>
              <TableCell>
                <span className="font-mono text-sm font-bold">
                  {shortId}
                </span>
              </TableCell>
              <TableCell>{customer}</TableCell>
              <TableCell title={address.length > 40 ? address : undefined}>
                {truncatedAddress}
              </TableCell>
              <TableCell>
                {order.delivery_assigned_to ? (
                  <span className="text-sm font-medium">
                    {order.delivery_assigned_to}
                  </span>
                ) : (
                  <AssignPopover
                    orderId={order.id}
                    onDeliveryUpdate={onDeliveryUpdate}
                  />
                )}
              </TableCell>
              <TableCell>
                <DeliveryStatusBadge status={order.delivery_status} />
              </TableCell>
              <TableCell>
                {nextStatus && (
                  <Button
                    size="sm"
                    variant={
                      nextStatus === 'delivered' ? 'default' : 'secondary'
                    }
                    onClick={() =>
                      statusMutation.mutate({
                        orderId: order.id,
                        status: nextStatus,
                      })
                    }
                    disabled={statusMutation.isPending}
                  >
                    {statusMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                    ) : (
                      nextLabel
                    )}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}
