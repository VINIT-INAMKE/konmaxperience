import { ShipmentStatus } from '@prisma/client';

export const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';
export const SHIPROCKET_TOKEN_KEY = 'shiprocket:token';
/** Shiprocket tokens live 10 days; cache for 9 so a refresh always precedes expiry. */
export const SHIPROCKET_TOKEN_TTL_SECONDS = 9 * 24 * 60 * 60;
export const SHIPROCKET_TIMEOUT_MS = 15_000;

/** Shiprocket `current_status` / webhook `shipment_status` -> our enum. */
export const SHIPROCKET_STATUS_MAP: Record<string, ShipmentStatus> = {
  'AWB ASSIGNED': ShipmentStatus.awb_assigned,
  'LABEL GENERATED': ShipmentStatus.awb_assigned,
  'PICKUP SCHEDULED': ShipmentStatus.pickup_scheduled,
  'PICKUP GENERATED': ShipmentStatus.pickup_scheduled,
  'PICKED UP': ShipmentStatus.picked_up,
  'IN TRANSIT': ShipmentStatus.in_transit,
  SHIPPED: ShipmentStatus.in_transit,
  'OUT FOR DELIVERY': ShipmentStatus.out_for_delivery,
  DELIVERED: ShipmentStatus.delivered,
  RTO: ShipmentStatus.rto,
  'RTO INITIATED': ShipmentStatus.rto,
  'RTO DELIVERED': ShipmentStatus.rto,
  CANCELED: ShipmentStatus.cancelled,
  CANCELLED: ShipmentStatus.cancelled,
  'PICKUP ERROR': ShipmentStatus.failed,
  UNDELIVERED: ShipmentStatus.failed,
  LOST: ShipmentStatus.failed,
};

/** Unknown provider strings map to `failed` so a shipment never silently stalls. */
export function mapShiprocketStatus(
  raw: string | null | undefined,
): ShipmentStatus {
  if (!raw) return ShipmentStatus.pending;
  return (
    SHIPROCKET_STATUS_MAP[raw.trim().toUpperCase()] ?? ShipmentStatus.failed
  );
}
