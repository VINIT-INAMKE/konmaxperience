'use client';

import { CalendarCheck, Store, Truck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import { formatCurrency, formatTaxRate } from '@/lib/format/currency';
import { ORDER_ITEM_STATUS_LABELS } from '@/lib/types/kds';
import type { OrderItemStatus } from '@/lib/types/kds';
import type { FulfilmentType } from '@/lib/types/catalog';
import type { StaffOrderItem } from './types';

/**
 * A mixed order is the normal case on the marketplace — one basket can carry a
 * counter line, a parcel and a seat at an experience — and each group is handed
 * over by a different team. Grouping by `fulfilment` is what makes the table
 * readable to the person who has to act on it.
 */
const FULFILMENT_ORDER: FulfilmentType[] = ['local', 'shipped', 'booking'];

const FULFILMENT_LABELS: Record<FulfilmentType, string> = {
  local: 'Local — counter, table or rider',
  shipped: 'Shipped — courier parcel',
  booking: 'Booking — seat at an experience',
};

const FULFILMENT_ICONS: Record<FulfilmentType, typeof Store> = {
  local: Store,
  shipped: Truck,
  booking: CalendarCheck,
};

const ITEM_STATUS_STYLES: Record<OrderItemStatus, string> = {
  pending: STATUS_BADGE.neutral,
  preparing: STATUS_BADGE.warning,
  ready: STATUS_BADGE.good,
  packed: STATUS_BADGE.info,
  shipped: STATUS_BADGE.info,
  delivered: STATUS_BADGE.good,
  attended: STATUS_BADGE.good,
  cancelled: STATUS_BADGE.serious,
};

function LineGroup({
  fulfilment,
  items,
}: {
  fulfilment: FulfilmentType;
  items: StaffOrderItem[];
}) {
  const Icon = FULFILMENT_ICONS[fulfilment];
  const groupTotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-ink-muted" />
          <h3 className="text-sm font-medium text-ink">
            {FULFILMENT_LABELS[fulfilment]}
          </h3>
          <span className="text-xs text-ink-faint">
            {items.length} {items.length === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
          {formatCurrency(groupTotal)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-raised">
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="space-y-1">
                    <span className="text-sm text-ink">
                      {item.product?.name ?? 'Unknown product'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.variant_id ? (
                        // `GET /orders/:id` does not join the variant, so the id
                        // is the honest thing to show — inventing a name here
                        // would be worse than admitting the join is missing.
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                          title={`Variant ${item.variant_id}`}
                        >
                          Variant {item.variant_id.slice(0, 8)}
                        </Badge>
                      ) : null}
                      {item.event_booking_id ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                          title={`Booking ${item.event_booking_id}`}
                        >
                          Booking {item.event_booking_id.slice(0, 8)}
                        </Badge>
                      ) : null}
                    </div>
                    {item.item_notes ? (
                      <p className="text-xs text-muted-foreground">
                        {item.item_notes}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {item.quantity}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCurrency(item.unit_price)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatTaxRate(item.tax_rate)}
                </TableCell>
                <TableCell>
                  <Badge className={ITEM_STATUS_STYLES[item.status]}>
                    {ORDER_ITEM_STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {formatCurrency(item.unit_price * item.quantity)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * The order's lines, grouped by fulfilment mode.
 *
 * Every price here is tax-**inclusive** (P5a decision 1); the GST column is the
 * rate carved out of the unit price, not a surcharge added to it.
 */
export function OrderLineTable({ items }: { items: StaffOrderItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-line py-10 text-center">
        <p className="text-sm text-muted-foreground">
          This order has no lines. That should not happen — check the order in
          the database before acting on it.
        </p>
      </div>
    );
  }

  const groups = FULFILMENT_ORDER.map((fulfilment) => ({
    fulfilment,
    items: items.filter((item) => item.fulfilment === fulfilment),
  })).filter((group) => group.items.length > 0);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-ink">Items</h2>
      {groups.map((group) => (
        <LineGroup
          key={group.fulfilment}
          fulfilment={group.fulfilment}
          items={group.items}
        />
      ))}
    </section>
  );
}

/** True when any line ships — the predicate the shipment panel mounts on. */
export function hasShippedLines(items: StaffOrderItem[]): boolean {
  return items.some((item) => item.fulfilment === 'shipped');
}
