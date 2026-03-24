'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/ops/pos/OrderStatusBadge';
import { ORDER_CHANNEL_LABELS } from '@/lib/types/kds';
import type { Order } from '@/lib/types/orders';
import { Eye } from 'lucide-react';

interface OrderHistoryTableProps {
  orders: Order[];
  isLoading: boolean;
  onSelectOrder: (order: Order) => void;
}

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrderHistoryTable({ orders, isLoading, onSelectOrder }: OrderHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Loading orders...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-16 text-center space-y-2">
        <h3 className="text-base font-medium">No orders today</h3>
        <p className="text-sm text-muted-foreground">
          Orders placed from the POS will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Order #</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="cursor-pointer"
              onClick={() => onSelectOrder(order)}
            >
              <TableCell>
                <span className="font-mono text-sm font-bold">
                  #{order.id.slice(-4).toUpperCase()}
                </span>
              </TableCell>
              <TableCell className="text-sm">
                {formatTime(order.created_at)}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.channel as never} />
                <span className="text-sm">
                  {ORDER_CHANNEL_LABELS[order.channel]}
                </span>
              </TableCell>
              <TableCell className="text-sm">
                {order.items?.length ?? 0}
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm font-bold">
                  {formatINR(order.total)}
                </span>
              </TableCell>
              <TableCell>
                {order.payment ? (
                  <OrderStatusBadge paymentStatus={order.payment.status} />
                ) : (
                  <span className="text-sm text-muted-foreground">&mdash;</span>
                )}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectOrder(order);
                  }}
                >
                  <Eye className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
