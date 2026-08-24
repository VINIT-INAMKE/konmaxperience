'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Loader2,
  Lock,
  PackageCheck,
  PackagePlus,
} from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { ORDER_CHANNEL_LABELS, ORDER_STATUS_LABELS } from '@/lib/types/kds';
import { PackDialog } from './PackDialog';
import { CANDIDATE_LIMIT, useToPackQueue, type ToPackRow } from './shipments-queries';

/**
 * The queue of orders that still need a box.
 *
 * The predicate is "**shipped lines, no `Shipment` row**" — never
 * `OrderItemStatus.packed`, which `confirm` sets on every shipped line before
 * anyone has touched the parcel (P5b decision 10). See `shipments-queries.ts`
 * for how the three reads are assembled into it.
 */
export function ToPackQueue({ live }: { live: boolean }) {
  const {
    rows,
    isLoading,
    isHydrating,
    isError,
    isForbidden,
    isTruncated,
    isScanIncomplete,
    refetch,
  } = useToPackQueue(live);

  const [packTarget, setPackTarget] = useState<ToPackRow | null>(null);

  if (isForbidden) {
    return (
      <Alert>
        <Lock className="size-4" />
        <AlertTitle>The pack queue needs the POS permission</AlertTitle>
        <AlertDescription>
          Working out which orders still need a parcel means reading the orders
          list, which is gated by <code>MANAGE_POS</code>. Shipments that have
          already been packed are on the Shipments tab and are unaffected.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Could not build the pack queue</AlertTitle>
        <AlertDescription>
          Either the open orders or the existing parcels did not come back, and
          a half-answer here would hide work rather than show it.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={refetch}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {isTruncated && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Showing the oldest {CANDIDATE_LIMIT} open orders</AlertTitle>
          <AlertDescription>
            There is more open work than one screen checks at a time. Pack what
            is here and the next batch appears.
          </AlertDescription>
        </Alert>
      )}

      {isScanIncomplete && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Older parcels were not all checked</AlertTitle>
          <AlertDescription>
            There are more shipments than this screen scans in one pass, so an
            order here may already have a parcel. Opening it will say so, and
            packing it twice is harmless.
          </AlertDescription>
        </Alert>
      )}

      {rows.length === 0 && !isHydrating ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <PackageCheck className="size-10 text-ink-faint" />
          <h2 className="text-lg font-semibold text-ink-muted">
            Nothing waiting to be packed
          </h2>
          <p className="max-w-sm text-center text-sm text-ink-muted">
            Every open order with shipped items already has a parcel. New orders
            land here as soon as they are paid.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.order.id}>
              <ToPackCard row={row} onPack={() => setPackTarget(row)} />
            </li>
          ))}
        </ul>
      )}

      {isHydrating && (
        <p
          className="flex items-center gap-2 text-xs text-ink-muted"
          aria-live="polite"
        >
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
          Checking the remaining open orders for shipped items…
        </p>
      )}

      {packTarget && (
        <PackDialog
          open
          onOpenChange={(open) => {
            if (!open) setPackTarget(null);
          }}
          order={packTarget.order}
          shippedItems={packTarget.shippedItems}
        />
      )}
    </div>
  );
}

function ToPackCard({ row, onPack }: { row: ToPackRow; onPack: () => void }) {
  const { order, shippedItems, units } = row;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link
              href={`/pos/orders/${order.id}`}
              className="rounded-sm text-base font-semibold text-ink underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              #{order.order_number}
            </Link>
            <span className="text-xs text-ink-muted">
              {ORDER_STATUS_LABELS[order.status]} ·{' '}
              {ORDER_CHANNEL_LABELS[order.channel]} ·{' '}
              {formatDateTime(order.created_at)}
            </span>
          </div>

          <p className="text-sm text-ink-subtle">
            {order.customer_name ?? 'Guest'}
            {order.customer_phone ? ` · ${order.customer_phone}` : ''}
          </p>

          {order.delivery_address && (
            <p className="max-w-prose text-xs text-ink-muted">
              {order.delivery_address}
            </p>
          )}

          <ul className="space-y-0.5 text-sm">
            {shippedItems.map((item) => (
              <li key={item.id} className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-ink-muted">
                  ×{item.quantity}
                </span>
                <span className="min-w-0 truncate">
                  {item.product?.name ?? 'Product'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <span className="text-xs text-ink-muted">
            {units} {units === 1 ? 'unit' : 'units'} to ship ·{' '}
            {formatCurrency(order.total)} order
          </span>
          <Button size="sm" onClick={onPack}>
            <PackagePlus className="size-3.5" />
            Pack parcel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
