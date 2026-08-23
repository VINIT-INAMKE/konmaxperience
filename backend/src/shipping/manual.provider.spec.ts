import {
  ShipmentStatus,
  ShippingProvider as ShippingProviderName,
} from '@prisma/client';
import { ManualProvider } from './manual.provider';

describe('ManualProvider', () => {
  const provider = new ManualProvider();
  const ref = {
    provider_order_id: null,
    provider_shipment_id: null,
    awb: 'MANUAL-1',
  };

  it('identifies as the manual provider', () => {
    expect(provider.name).toBe(ShippingProviderName.manual);
  });

  it('is always serviceable at zero rate', async () => {
    const result = await provider.checkServiceability({
      pickup_pincode: '560001',
      delivery_pincode: '110001',
      weight_grams: 500,
      declared_value_paise: 100000,
      cod: false,
    });
    expect(result).toEqual({
      serviceable: true,
      rate: 0,
      courier_name: null,
      courier_id: null,
      etd: null,
    });
  });

  it('creates a shipment with no provider references', async () => {
    await expect(
      provider.createShipment({
        order_number: 1001,
        order_placed_at: new Date('2026-08-23T10:00:00.000Z'),
        pickup_location_code: 'KONMA-VILLA',
        billing: {
          name: 'A',
          phone: '9999999999',
          email: null,
          address: 'Line 1',
          landmark: null,
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        lines: [],
        sub_total_paise: 0,
        weight_grams: 500,
        dimensions_cm: { length: 20, breadth: 15, height: 10 },
      }),
    ).resolves.toEqual({
      provider_order_id: null,
      provider_shipment_id: null,
    });
  });

  it('returns empty refs so staff can paste an AWB later', async () => {
    await expect(provider.assignAwb(ref)).resolves.toEqual({
      awb: null,
      courier_name: null,
      courier_id: null,
    });
    await expect(provider.getLabel(ref)).resolves.toEqual({ label_url: null });
  });

  it('reports pickup as scheduled with no token', async () => {
    await expect(provider.schedulePickup(ref)).resolves.toEqual({
      scheduled: true,
      pickup_token: null,
      pickup_scheduled_date: null,
    });
  });

  it('tracks to pending with no events', async () => {
    await expect(provider.track('MANUAL-1')).resolves.toEqual({
      status: ShipmentStatus.pending,
      courier_name: null,
      tracking_url: null,
      events: [],
    });
  });

  it('cancels unconditionally', async () => {
    await expect(provider.cancel(ref)).resolves.toEqual({ cancelled: true });
  });

  it('never touches the network', async () => {
    const fetchSpy = jest.fn();
    const original = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    try {
      await provider.checkServiceability({
        pickup_pincode: '560001',
        delivery_pincode: '110001',
        weight_grams: 1,
        declared_value_paise: 1,
        cod: false,
      });
      await provider.track('X');
      await provider.cancel(ref);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = original;
    }
  });
});
