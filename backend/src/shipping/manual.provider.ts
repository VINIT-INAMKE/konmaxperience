import { Injectable } from '@nestjs/common';
import {
  ShipmentStatus,
  ShippingProvider as ShippingProviderName,
} from '@prisma/client';
import type {
  AssignAwbResult,
  CancelResult,
  CreateShipmentResult,
  LabelResult,
  SchedulePickupResult,
  ServiceabilityRequest,
  ServiceabilityResult,
  ShipmentDraft,
  ShipmentRef,
  ShippingProviderPort,
  TrackResult,
} from './shipping.types';

/**
 * SPEC §5.3 fallback: staff paste an AWB and tracking URL into the shipment.
 * Every method is a no-op that succeeds, so the shipments queue behaves identically
 * whichever provider is configured — and no jest run can reach the network, since
 * this is the seeded default (`SystemSetting['shipping'].provider = 'manual'`).
 *
 * The parameters are declared but unused: keeping the full port signature means a
 * caller that injects `ManualProvider` directly still type-checks against the
 * arguments every other provider takes.
 */
@Injectable()
export class ManualProvider implements ShippingProviderPort {
  readonly name = ShippingProviderName.manual;

  checkServiceability(
    req: ServiceabilityRequest,
  ): Promise<ServiceabilityResult> {
    return Promise.resolve({
      serviceable: true,
      rate: 0,
      courier_name: null,
      courier_id: null,
      etd: null,
    });
  }

  createShipment(draft: ShipmentDraft): Promise<CreateShipmentResult> {
    return Promise.resolve({
      provider_order_id: null,
      provider_shipment_id: null,
    });
  }

  assignAwb(ref: ShipmentRef): Promise<AssignAwbResult> {
    return Promise.resolve({ awb: null, courier_name: null, courier_id: null });
  }

  schedulePickup(ref: ShipmentRef): Promise<SchedulePickupResult> {
    return Promise.resolve({
      scheduled: true,
      pickup_token: null,
      pickup_scheduled_date: null,
    });
  }

  getLabel(ref: ShipmentRef): Promise<LabelResult> {
    return Promise.resolve({ label_url: null });
  }

  track(awb: string): Promise<TrackResult> {
    return Promise.resolve({
      status: ShipmentStatus.pending,
      courier_name: null,
      tracking_url: null,
      events: [],
    });
  }

  cancel(ref: ShipmentRef): Promise<CancelResult> {
    return Promise.resolve({ cancelled: true });
  }
}
