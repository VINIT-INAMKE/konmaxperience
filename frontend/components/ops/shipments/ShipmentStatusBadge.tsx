import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import {
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from '@/lib/types/shipments';

/**
 * Colour carries *who the parcel is waiting on*, not just where it is:
 *
 * - **amber** — waiting on us. `pending` needs an AWB, `awb_assigned` needs a
 *   pickup. These are the only two rows a packer can act on.
 * - **neutral** — handed over, waiting on the courier to turn up.
 * - **blue** — moving. Nothing to do but watch.
 * - **green** — delivered.
 * - **rose / dark red** — `rto` came back, `failed` did not make it.
 * - **struck through** — cancelled.
 *
 * That mapping is why the queue is scannable: everything amber is work.
 */
const STATUS_CLASSES: Record<ShipmentStatus, string> = {
  pending: STATUS_BADGE.warning,
  awb_assigned: STATUS_BADGE.warning,
  pickup_scheduled: STATUS_BADGE.neutral,
  picked_up: STATUS_BADGE.info,
  in_transit: STATUS_BADGE.info,
  out_for_delivery: STATUS_BADGE.info,
  delivered: STATUS_BADGE.good,
  rto: STATUS_BADGE.serious,
  cancelled: STATUS_BADGE.muted,
  failed: STATUS_BADGE.critical,
};

interface ShipmentStatusBadgeProps {
  status: ShipmentStatus;
  className?: string;
}

export function ShipmentStatusBadge({
  status,
  className,
}: ShipmentStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${STATUS_CLASSES[status]}${className ? ` ${className}` : ''}`}
    >
      {SHIPMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** The bare class, for a row that renders its own element rather than a badge. */
export function shipmentStatusClass(status: ShipmentStatus): string {
  return STATUS_CLASSES[status];
}
