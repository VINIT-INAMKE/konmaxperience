import {
  ShipmentStatus,
  ShippingProvider as ShippingProviderName,
} from '@prisma/client';

/**
 * SPEC §5.3 — the shipping port and its transport-agnostic payloads.
 *
 * These are plain interfaces, deliberately *not* Prisma model types (plan
 * decision 11): the adapter must compile and unit-test before the `Shipment`
 * models land, and the callers (shipments queue, webhook) map their rows onto
 * these shapes at the boundary.
 *
 * Every money value crossing this boundary is an **integer number of paise**.
 */

export interface ServiceabilityRequest {
  pickup_pincode: string;
  delivery_pincode: string;
  weight_grams: number;
  declared_value_paise: number;
  /** COD is not supported — the storefront is prepaid only (SPEC §5.2). */
  cod: false;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  /** Forward shipping charge in **paise**. `0` for the manual provider. */
  rate: number;
  courier_name: string | null;
  courier_id: string | null;
  etd: Date | null;
  reason?: string;
}

export interface ShipmentDraftLine {
  name: string;
  sku: string;
  quantity: number;
  /** Unit price in paise (tax-inclusive, matching `OrderItem.unit_price`). */
  unit_price: number;
  hsn_code: string | null;
}

export interface ShipmentDraft {
  order_number: number;
  order_placed_at: Date;
  pickup_location_code: string;
  billing: {
    name: string;
    phone: string;
    email: string | null;
    address: string;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  lines: ShipmentDraftLine[];
  sub_total_paise: number;
  weight_grams: number;
  dimensions_cm: { length: number; breadth: number; height: number };
}

export interface ShipmentRef {
  provider_order_id: string | null;
  provider_shipment_id: string | null;
  awb: string | null;
}

export interface CreateShipmentResult {
  provider_order_id: string | null;
  provider_shipment_id: string | null;
}

export interface AssignAwbResult {
  awb: string | null;
  courier_name: string | null;
  courier_id: string | null;
}

export interface SchedulePickupResult {
  scheduled: boolean;
  pickup_token: string | null;
  pickup_scheduled_date: Date | null;
}

export interface LabelResult {
  label_url: string | null;
}

export interface TrackEvent {
  status: ShipmentStatus;
  occurred_at: Date;
  raw: unknown;
}

export interface TrackResult {
  status: ShipmentStatus;
  courier_name: string | null;
  tracking_url: string | null;
  events: TrackEvent[];
}

export interface CancelResult {
  cancelled: boolean;
  reason?: string;
}

/** SPEC §5.3. Every method is total: it resolves or throws a Nest HTTP exception. */
export interface ShippingProviderPort {
  readonly name: ShippingProviderName;
  checkServiceability(
    req: ServiceabilityRequest,
  ): Promise<ServiceabilityResult>;
  createShipment(draft: ShipmentDraft): Promise<CreateShipmentResult>;
  assignAwb(ref: ShipmentRef): Promise<AssignAwbResult>;
  schedulePickup(ref: ShipmentRef): Promise<SchedulePickupResult>;
  getLabel(ref: ShipmentRef): Promise<LabelResult>;
  track(awb: string): Promise<TrackResult>;
  cancel(ref: ShipmentRef): Promise<CancelResult>;
}
