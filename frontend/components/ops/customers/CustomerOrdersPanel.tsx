'use client';

/**
 * The customer's recent orders (`GET /customers/:id` → `orders`).
 *
 * Two facts shape the money in here:
 *
 * 1. **`Order.subtotal` is GST-inclusive and `tax_amount` is carved out of it**
 *    (P5a decision 1). GST is therefore rendered as an *of which* line under
 *    the total, never as a `+` term. `total = subtotal − discount_amount −
 *    loyalty redemption + shipping_amount`.
 * 2. **`discount_amount` bundles the coupon and the loyalty burn** into one
 *    column (P5a decision 23). This panel shows the bundled figure and does not
 *    invent a split — the coupon half is in the Coupons panel, the loyalty half
 *    in the ledger.
 *
 * `orders` is a **capped, recent slice** (the 50 newest); `_count.orders` is the
 * real total, which is why the header states both.
 */

import Link from 'next/link';
import { ExternalLink, ShoppingBag } from 'lucide-react';
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
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { ORDER_CHANNEL_LABELS } from '@/lib/types/kds';
import type { CustomerDetailOrder } from '@/lib/types/customers';
import { PanelEmpty, PanelHeading } from '@/components/ops/customers/CustomerPanel';

interface CustomerOrdersPanelProps {
  orders: CustomerDetailOrder[];
  /** `_count.orders` — the real lifetime total, which `orders` truncates. */
  totalOrders: number;
}

/** The product names on an order, trimmed to something a cell can hold. */
function itemsLabel(order: CustomerDetailOrder): string {
  const names = order.items.map((item) => `${item.quantity}× ${item.product.name}`);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

export function CustomerOrdersPanel({
  orders,
  totalOrders,
}: CustomerOrdersPanelProps) {
  if (orders.length === 0) {
    return (
      <PanelEmpty
        icon={ShoppingBag}
        title="No orders yet"
        description="Orders placed from the storefront or the POS will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <PanelHeading
        title={`${orders.length} of ${totalOrders} orders`}
        hint="Newest first. Totals include GST — tax is carved out of the subtotal, never added to it."
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Order</TableHead>
              <TableHead className="hidden md:table-cell">Placed</TableHead>
              <TableHead className="hidden sm:table-cell">Channel</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Payment</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <span className="block font-mono text-sm font-bold">
                    #{order.order_number}
                  </span>
                  <span className="block max-w-[22rem] truncate text-xs text-muted-foreground">
                    {itemsLabel(order)}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {formatDateTime(order.created_at)}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">
                  {ORDER_CHANNEL_LABELS[order.channel] ?? order.channel}
                </TableCell>
                <TableCell className="text-right">
                  <span className="block font-mono text-sm font-bold tabular-nums">
                    {formatCurrency(order.total)}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    of which GST {formatCurrency(order.tax_amount)}
                  </span>
                  {order.discount_amount > 0 && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      less {formatCurrency(order.discount_amount)} discount
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {order.payment ? (
                    <OrderStatusBadge paymentStatus={order.payment.status} />
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {/* `/pos/orders/[id]` is the staff order detail route; `/orders/*`
                      belongs to the customer (P5b decision 8). */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    aria-label={`Open order ${order.order_number}`}
                    render={<Link href={`/pos/orders/${order.id}`} />}
                  >
                    <ExternalLink />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
