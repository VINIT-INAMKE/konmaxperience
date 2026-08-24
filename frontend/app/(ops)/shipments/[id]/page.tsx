'use client';

/**
 * One parcel, end to end: what it is, where it is, and the one or two moves the
 * lifecycle still allows.
 *
 * The action row is derived from `SHIPMENT_TRANSITIONS`, which mirrors
 * `ShipmentsService.TRANSITIONS` exactly — so a terminal parcel (`delivered`,
 * `rto`, `cancelled`, `failed`) renders no buttons at all rather than offering
 * a move the server would refuse. Printing a label is deliberately *not* gated
 * that way: it is not a transition, and a delivered parcel's label can still be
 * reprinted.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Ticket,
  XCircle,
} from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime, formatEtd } from '@/lib/format/date';
import { ORDER_STATUS_LABELS } from '@/lib/types/kds';
import { canTransitionShipment } from '@/lib/types/shipments';
import { useShipmentsRealtime } from '@/lib/hooks/use-shipments-realtime';
import { AssignAwbDialog } from '@/components/ops/shipments/AssignAwbDialog';
import { CancelShipmentDialog } from '@/components/ops/shipments/CancelShipmentDialog';
import { LabelButton } from '@/components/ops/shipments/LabelButton';
import { SchedulePickupButton } from '@/components/ops/shipments/SchedulePickupButton';
import { ShipmentEventTimeline } from '@/components/ops/shipments/ShipmentEventTimeline';
import { ShipmentStatusBadge } from '@/components/ops/shipments/ShipmentStatusBadge';
import { LiveIndicator } from '@/components/ops/shipments/ShipmentFilterBar';
import { useShipmentDetail } from '@/components/ops/shipments/shipments-queries';

export default function ShipmentDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { live } = useShipmentsRealtime();
  const { data: shipment, isLoading, isError, refetch } = useShipmentDetail(id, live);

  const [awbOpen, setAwbOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !shipment) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load this parcel</AlertTitle>
          <AlertDescription>
            It may have been removed, or the request did not get through.
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      </div>
    );
  }

  const etd = formatEtd(shipment.etd);
  const canAssignAwb = canTransitionShipment(shipment.status, 'awb_assigned');
  const canSchedulePickup = canTransitionShipment(
    shipment.status,
    'pickup_scheduled',
  );
  const canCancel = canTransitionShipment(shipment.status, 'cancelled');
  const hasActions = canAssignAwb || canSchedulePickup || canCancel;

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Order #{shipment.order.order_number}
            </h1>
            <ShipmentStatusBadge status={shipment.status} />
          </div>
          <p className="text-sm text-ink-muted">
            {shipment.order.customer_name ?? 'Guest'}
            {shipment.order.customer_phone
              ? ` · ${shipment.order.customer_phone}`
              : ''}{' '}
            · Order is {ORDER_STATUS_LABELS[shipment.order.status]}
          </p>
        </div>
        <LiveIndicator live={live} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Parcel</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label="AWB">
            {shipment.awb ? (
              <span className="font-mono text-sm">{shipment.awb}</span>
            ) : (
              <span className="text-ink-faint">Not assigned</span>
            )}
          </Fact>
          <Fact label="Courier">
            {shipment.courier_name ?? <span className="text-ink-faint">—</span>}
          </Fact>
          <Fact label="Provider">
            {shipment.provider === 'manual' ? 'Manual' : 'Shiprocket'}
          </Fact>
          <Fact label="Weight">
            {shipment.weight_grams.toLocaleString('en-IN')} g
          </Fact>
          <Fact label="Courier charge">
            {shipment.cost === null ? (
              <span className="text-ink-faint">Not quoted</span>
            ) : (
              formatCurrency(shipment.cost)
            )}
          </Fact>
          <Fact label="Expected">
            {etd ? (
              <>
                {etd}
                <span className="block text-xs text-ink-faint">
                  {formatDateTime(shipment.etd)}
                </span>
              </>
            ) : (
              <span className="text-ink-faint">No estimate</span>
            )}
          </Fact>
          <Fact label="Pickup point">
            {shipment.pickup_location_code || (
              <span className="text-ink-faint">Default</span>
            )}
          </Fact>
          <Fact label="Packed">{formatDateTime(shipment.created_at)}</Fact>
          {shipment.order.delivery_address && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-4">
              <Fact label="Ships to">{shipment.order.delivery_address}</Fact>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {canAssignAwb && (
          <Button size="sm" onClick={() => setAwbOpen(true)}>
            <Ticket className="size-3.5" />
            {shipment.awb ? 'Update AWB' : 'Assign AWB'}
          </Button>
        )}
        {canSchedulePickup && <SchedulePickupButton shipment={shipment} />}
        <LabelButton shipment={shipment} />
        {shipment.tracking_url && (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={
              <a
                href={shipment.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink className="size-3.5" />
            Track
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="size-3.5" />
            Cancel parcel
          </Button>
        )}
        {!hasActions && (
          <p className="text-xs text-ink-muted">
            This parcel has reached a final state — there is nothing left to do
            to it here.
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What is in the box</CardTitle>
        </CardHeader>
        <CardContent>
          {shipment.order.items.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No shipped lines came back for this order.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-medium">{item.product.name}</span>
                      {item.variant && (
                        <p className="text-xs text-ink-muted">
                          {item.variant.name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="font-mono text-xs text-ink-muted">
                        {item.variant?.sku ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(item.unit_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="pt-3 text-xs text-ink-muted">
            Only the shipped lines are listed. Anything on this order that is
            eaten in or booked is handled on its own lane.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <ShipmentEventTimeline
            events={shipment.events}
            currentStatus={shipment.status}
          />
        </CardContent>
      </Card>

      <AssignAwbDialog
        open={awbOpen}
        onOpenChange={setAwbOpen}
        shipment={shipment}
      />
      <CancelShipmentDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        shipment={shipment}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/shipments"
      className="inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ArrowLeft className="size-3.5" />
      All shipments
    </Link>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="text-sm break-words text-ink">{children}</div>
    </div>
  );
}
