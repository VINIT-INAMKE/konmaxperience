'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight, PackageX, Ticket } from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format/date';
import {
  canTransitionShipment,
  type ShipmentListRow,
} from '@/lib/types/shipments';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';
import { AssignAwbDialog } from './AssignAwbDialog';
import { SchedulePickupButton } from './SchedulePickupButton';
import { useShipmentList } from './shipments-queries';
import type { ShipmentStatusFilter } from './ShipmentFilterBar';

interface ShipmentsTableProps {
  status: ShipmentStatusFilter;
  live: boolean;
}

export function ShipmentsTable({ status, live }: ShipmentsTableProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useShipmentList(status, live);

  const [awbTarget, setAwbTarget] = useState<ShipmentListRow | null>(null);

  const rows = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Could not load shipments</AlertTitle>
        <AlertDescription>
          The parcel queue did not come back. Nothing has been lost — the
          shipments themselves are unaffected.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <PackageX className="size-10 text-ink-faint" />
        <h2 className="text-lg font-semibold text-ink-muted">
          No parcels here
        </h2>
        <p className="max-w-sm text-center text-sm text-ink-muted">
          {status === 'all'
            ? 'Parcels appear once an order with shipped items has been packed.'
            : 'Nothing is sitting at this status right now. Try “All statuses”.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead className="hidden sm:table-cell">Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">AWB</TableHead>
            <TableHead className="hidden lg:table-cell">Packed</TableHead>
            <TableHead className="text-right">Next step</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((shipment) => (
            <TableRow key={shipment.id}>
              <TableCell>
                <Link
                  href={`/shipments/${shipment.id}`}
                  className="rounded-sm font-medium text-ink underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  #{shipment.order.order_number}
                </Link>
                <p className="text-xs text-ink-muted sm:hidden">
                  {shipment.order.customer_name ?? 'Guest'}
                </p>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <span className="text-sm">
                  {shipment.order.customer_name ?? 'Guest'}
                </span>
                {shipment.order.customer_phone && (
                  <p className="text-xs text-ink-muted">
                    {shipment.order.customer_phone}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <ShipmentStatusBadge status={shipment.status} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {shipment.awb ? (
                  <>
                    <span className="font-mono text-xs">{shipment.awb}</span>
                    {shipment.courier_name && (
                      <p className="text-xs text-ink-muted">
                        {shipment.courier_name}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-ink-faint">Not assigned</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="text-xs text-ink-muted">
                  {formatDateTime(shipment.created_at)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <NextStep
                    shipment={shipment}
                    onAssignAwb={() => setAwbTarget(shipment)}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={<Link href={`/shipments/${shipment.id}`} />}
                    aria-label={`Open parcel for order ${shipment.order.order_number}`}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more parcels'}
          </Button>
        </div>
      )}

      {awbTarget && (
        <AssignAwbDialog
          open
          onOpenChange={(open) => {
            if (!open) setAwbTarget(null);
          }}
          shipment={awbTarget}
        />
      )}
    </>
  );
}

/**
 * One button, not four: the row shows the single move the lifecycle allows next
 * and the detail page carries the full action set. A terminal status
 * (`delivered`, `rto`, `cancelled`, `failed`) has no outgoing edge in
 * `SHIPMENT_TRANSITIONS`, so it renders nothing rather than a button the server
 * would refuse.
 */
function NextStep({
  shipment,
  onAssignAwb,
}: {
  shipment: ShipmentListRow;
  onAssignAwb: () => void;
}) {
  if (canTransitionShipment(shipment.status, 'awb_assigned')) {
    return (
      <Button size="sm" onClick={onAssignAwb}>
        <Ticket className="size-3.5" />
        Assign AWB
      </Button>
    );
  }
  if (canTransitionShipment(shipment.status, 'pickup_scheduled')) {
    return <SchedulePickupButton shipment={shipment} />;
  }
  return <span className="text-xs text-ink-faint">With the courier</span>;
}
