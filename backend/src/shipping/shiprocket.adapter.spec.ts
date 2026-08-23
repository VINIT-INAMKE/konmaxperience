import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ShipmentStatus,
  ShippingProvider as ShippingProviderName,
} from '@prisma/client';
import { ShiprocketAdapter } from './shiprocket.adapter';
import { mockRedis, mockRedisClient } from '../test-utils/mock-providers';
import {
  SHIPROCKET_BASE_URL,
  SHIPROCKET_TOKEN_KEY,
  SHIPROCKET_TOKEN_TTL_SECONDS,
  mapShiprocketStatus,
} from './shipping.constants';
import type { ShipmentDraft, ShipmentRef } from './shipping.types';

const CREDENTIALS: Record<string, string> = {
  SHIPROCKET_EMAIL: 'ops@konma.io',
  SHIPROCKET_PASSWORD: 'pw',
};

const config = { get: (k: string) => CREDENTIALS[k] };

/**
 * `mock-providers.ts` is Task 1's file, so the Shiprocket-only `setex` is added
 * locally rather than by editing the shared registry.
 */
function shiprocketRedisClient() {
  return { ...mockRedisClient(), setex: jest.fn() };
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

/** Typed view of one recorded `fetch` call. */
function callAt(mock: jest.Mock, index: number): [string, RequestInit] {
  return mock.mock.calls[index] as [string, RequestInit];
}

function bodyOf(init: RequestInit): Record<string, unknown> {
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

const REF: ShipmentRef = {
  provider_order_id: '901',
  provider_shipment_id: '77',
  awb: null,
};

const DRAFT: ShipmentDraft = {
  order_number: 1042,
  order_placed_at: new Date('2026-08-23T10:30:00.000Z'),
  pickup_location_code: 'KONMA-VILLA',
  billing: {
    name: 'Asha R',
    phone: '9876543210',
    email: 'asha@example.com',
    address: '12 Palm Grove',
    landmark: 'Near the lake',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  },
  lines: [
    {
      name: 'Wild Honey 500g',
      sku: 'HNY-500',
      quantity: 2,
      unit_price: 45000,
      hsn_code: '0409',
    },
  ],
  sub_total_paise: 90000,
  weight_grams: 1200,
  dimensions_cm: { length: 20, breadth: 15, height: 10 },
};

describe('ShiprocketAdapter', () => {
  let redisClient: ReturnType<typeof shiprocketRedisClient>;
  let adapter: ShiprocketAdapter;
  let fetchMock: jest.Mock;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    redisClient = shiprocketRedisClient();
    fetchMock = jest.fn();
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    adapter = new ShiprocketAdapter(
      config as never,
      mockRedis(redisClient) as never,
    );
    // The adapter logs every provider failure; keep the suite output readable.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('identifies as the shiprocket provider', () => {
    expect(adapter.name).toBe(ShippingProviderName.shiprocket);
  });

  // ---- auth -------------------------------------------------------------

  it('logs in once and caches the token for ~9 days', async () => {
    redisClient.get.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-1' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            available_courier_companies: [
              {
                courier_name: 'Delhivery',
                courier_company_id: 12,
                rate: 79,
                etd: '2026-08-27 18:00',
              },
            ],
          },
        }),
      );

    const result = await adapter.checkServiceability({
      pickup_pincode: '560001',
      delivery_pincode: '110001',
      weight_grams: 500,
      declared_value_paise: 100000,
      cod: false,
    });

    expect(redisClient.setex).toHaveBeenCalledWith(
      SHIPROCKET_TOKEN_KEY,
      SHIPROCKET_TOKEN_TTL_SECONDS,
      'tok-1',
    );
    expect(result.serviceable).toBe(true);
    expect(result.rate).toBe(7900); // paise
    expect(result.courier_name).toBe('Delhivery');
    expect(result.courier_id).toBe('12');
    expect(result.etd).toEqual(new Date('2026-08-27T18:00'));

    const [loginUrl, loginInit] = callAt(fetchMock, 0);
    expect(loginUrl).toBe(`${SHIPROCKET_BASE_URL}/auth/login`);
    expect(bodyOf(loginInit)).toEqual({
      email: 'ops@konma.io',
      password: 'pw',
    });
  });

  it('reuses the cached token without calling auth/login', async () => {
    redisClient.get.mockResolvedValue('tok-cached');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { available_courier_companies: [] } }),
    );

    const result = await adapter.checkServiceability({
      pickup_pincode: '560001',
      delivery_pincode: '999999',
      weight_grams: 500,
      declared_value_paise: 1,
      cod: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.serviceable).toBe(false);
    expect(result.rate).toBe(0);
    expect(result.reason).toBe('No courier serves this pincode');

    const [, init] = callAt(fetchMock, 0);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok-cached',
    );
  });

  it('falls back to the in-process token when Redis is unavailable', async () => {
    const noRedis = { getClient: jest.fn().mockReturnValue(null) };
    adapter = new ShiprocketAdapter(config as never, noRedis as never);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-mem' }))
      .mockResolvedValueOnce(jsonResponse({ label_url: 'https://l/1.pdf' }))
      .mockResolvedValueOnce(jsonResponse({ label_url: 'https://l/2.pdf' }));

    await adapter.getLabel(REF);
    await adapter.getLabel(REF);

    // login once, then two authenticated calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, second] = callAt(fetchMock, 2);
    expect((second.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok-mem',
    );
  });

  it('re-authenticates once on a 401 and retries the call', async () => {
    redisClient.get.mockResolvedValue('stale');
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ message: 'Unauthorized' }, false, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-2' }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { available_courier_companies: [] } }),
      );

    await adapter.checkServiceability({
      pickup_pincode: '560001',
      delivery_pincode: '110001',
      weight_grams: 500,
      declared_value_paise: 1,
      cod: false,
    });

    expect(redisClient.del).toHaveBeenCalledWith(SHIPROCKET_TOKEN_KEY);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, retryInit] = callAt(fetchMock, 2);
    expect((retryInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok-2',
    );
  });

  it('gives up after a single re-auth when the retry is also rejected', async () => {
    redisClient.get.mockResolvedValue('stale');
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ message: 'Unauthorized' }, false, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-2' }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Nope' }, false, 401));

    await expect(adapter.track('AWB1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws when Shiprocket credentials are missing', async () => {
    const emptyConfig = { get: () => undefined };
    adapter = new ShiprocketAdapter(
      emptyConfig as never,
      mockRedis(redisClient) as never,
    );
    redisClient.get.mockResolvedValue(null);

    await expect(adapter.track('AWB1')).rejects.toThrow(
      /credentials are not configured/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when auth/login answers without a token', async () => {
    redisClient.get.mockResolvedValue(null);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'bad creds' }, false, 403),
    );
    await expect(adapter.track('AWB1')).rejects.toThrow(
      /Shiprocket login failed \(403\)/,
    );
  });

  it('honours a SHIPROCKET_BASE_URL override', async () => {
    const sandbox = {
      get: (k: string) =>
        k === 'SHIPROCKET_BASE_URL'
          ? 'https://sandbox.local/v1/external'
          : CREDENTIALS[k],
    };
    adapter = new ShiprocketAdapter(
      sandbox as never,
      mockRedis(redisClient) as never,
    );
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ label_url: null }));

    await adapter.getLabel(REF);
    expect(callAt(fetchMock, 0)[0]).toBe(
      'https://sandbox.local/v1/external/courier/generate/label',
    );
  });

  it('accepts an injected fetch instead of the global one', async () => {
    const injected = jest
      .fn()
      .mockResolvedValue(jsonResponse({ label_url: 'https://l/x.pdf' }));
    adapter = new ShiprocketAdapter(
      config as never,
      mockRedis(redisClient) as never,
      injected as never,
    );
    redisClient.get.mockResolvedValue('tok');

    await expect(adapter.getLabel(REF)).resolves.toEqual({
      label_url: 'https://l/x.pdf',
    });
    expect(injected).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ---- serviceability ---------------------------------------------------

  it('picks the cheapest courier and converts rupees to paise', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          available_courier_companies: [
            { courier_name: 'BlueDart', courier_company_id: 5, rate: 129.5 },
            { courier_name: 'Ekart', courier_company_id: 9, rate: 64.25 },
            { courier_name: 'Delhivery', courier_company_id: 12, rate: 79 },
          ],
        },
      }),
    );

    const result = await adapter.checkServiceability({
      pickup_pincode: '560001',
      delivery_pincode: '110001',
      weight_grams: 1200,
      declared_value_paise: 250000,
      cod: false,
    });

    expect(result).toEqual({
      serviceable: true,
      rate: 6425,
      courier_name: 'Ekart',
      courier_id: '9',
      etd: null,
    });

    const [url] = callAt(fetchMock, 0);
    expect(url).toContain('courier/serviceability/?');
    expect(url).toContain('pickup_postcode=560001');
    expect(url).toContain('delivery_postcode=110001');
    expect(url).toContain('weight=1.200');
    expect(url).toContain('cod=0');
    expect(url).toContain('declared_value=2500.00');
  });

  // ---- order lifecycle --------------------------------------------------

  it('creates an adhoc order with rupee amounts and kilogram weight', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ order_id: 901, shipment_id: 77 }),
    );

    await expect(adapter.createShipment(DRAFT)).resolves.toEqual({
      provider_order_id: '901',
      provider_shipment_id: '77',
    });

    const [url, init] = callAt(fetchMock, 0);
    expect(url).toBe(`${SHIPROCKET_BASE_URL}/orders/create/adhoc`);
    expect(init.method).toBe('POST');
    const payload = bodyOf(init);
    expect(payload).toMatchObject({
      order_id: '1042',
      order_date: '2026-08-23 10:30',
      pickup_location: 'KONMA-VILLA',
      billing_customer_name: 'Asha R',
      billing_address_2: 'Near the lake',
      billing_country: 'India',
      shipping_is_billing: true,
      payment_method: 'Prepaid',
      sub_total: '900.00',
      weight: '1.200',
      length: 20,
      breadth: 15,
      height: 10,
    });
    expect(payload.order_items).toEqual([
      {
        name: 'Wild Honey 500g',
        sku: 'HNY-500',
        units: 2,
        selling_price: '450.00',
        hsn: '0409',
      },
    ]);
  });

  it('returns null provider ids when create/adhoc omits them', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await expect(adapter.createShipment(DRAFT)).resolves.toEqual({
      provider_order_id: null,
      provider_shipment_id: null,
    });
  });

  it('assigns an AWB from the nested response envelope', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        response: {
          data: {
            awb_code: '1234567890',
            courier_name: 'Delhivery',
            courier_company_id: 12,
          },
        },
      }),
    );

    await expect(adapter.assignAwb(REF)).resolves.toEqual({
      awb: '1234567890',
      courier_name: 'Delhivery',
      courier_id: '12',
    });
    const [url, init] = callAt(fetchMock, 0);
    expect(url).toBe(`${SHIPROCKET_BASE_URL}/courier/assign/awb`);
    expect(bodyOf(init)).toEqual({ shipment_id: '77' });
  });

  it('returns a null AWB when the envelope is empty', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ response: {} }));
    await expect(adapter.assignAwb(REF)).resolves.toEqual({
      awb: null,
      courier_name: null,
      courier_id: null,
    });
  });

  it('schedules a pickup and reports the token and date', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        pickup_token_number: 'PT-9',
        pickup_scheduled_date: '2026-08-25',
      }),
    );

    const result = await adapter.schedulePickup(REF);
    expect(result.scheduled).toBe(true);
    expect(result.pickup_token).toBe('PT-9');
    expect(result.pickup_scheduled_date).toEqual(new Date('2026-08-25'));
    const [url, init] = callAt(fetchMock, 0);
    expect(url).toBe(`${SHIPROCKET_BASE_URL}/courier/generate/pickup`);
    expect(bodyOf(init)).toEqual({ shipment_id: ['77'] });
  });

  it('generates a label', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ label_url: 'https://labels/77.pdf' }),
    );
    await expect(adapter.getLabel(REF)).resolves.toEqual({
      label_url: 'https://labels/77.pdf',
    });
  });

  it('cancels by provider order id', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 200 }));
    await expect(adapter.cancel(REF)).resolves.toEqual({ cancelled: true });
    const [url, init] = callAt(fetchMock, 0);
    expect(url).toBe(`${SHIPROCKET_BASE_URL}/orders/cancel`);
    expect(bodyOf(init)).toEqual({ ids: [901] });
  });

  // ---- tracking ---------------------------------------------------------

  it('maps provider tracking statuses onto ShipmentStatus', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        tracking_data: {
          track_url: 'https://track/1',
          shipment_track: [
            { courier_name: 'Delhivery', current_status: 'OUT FOR DELIVERY' },
          ],
          shipment_track_activities: [
            {
              status: 'IN TRANSIT',
              date: '2026-08-25 09:00:00',
              activity: 'Departed',
            },
          ],
        },
      }),
    );

    const result = await adapter.track('AWB123');
    expect(result.status).toBe(ShipmentStatus.out_for_delivery);
    expect(result.courier_name).toBe('Delhivery');
    expect(result.events[0].status).toBe(ShipmentStatus.in_transit);
    expect(result.events[0].occurred_at).toEqual(
      new Date('2026-08-25T09:00:00'),
    );
    expect(result.events[0].raw).toMatchObject({ activity: 'Departed' });
    expect(result.tracking_url).toBe('https://track/1');
    expect(callAt(fetchMock, 0)[0]).toBe(
      `${SHIPROCKET_BASE_URL}/courier/track/awb/AWB123`,
    );
  });

  it('degrades to pending with no events when tracking_data is absent', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await expect(adapter.track('AWB123')).resolves.toEqual({
      status: ShipmentStatus.pending,
      courier_name: null,
      tracking_url: null,
      events: [],
    });
  });

  it('url-encodes the AWB', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await adapter.track('AWB 12/3');
    expect(callAt(fetchMock, 0)[0]).toBe(
      `${SHIPROCKET_BASE_URL}/courier/track/awb/AWB%2012%2F3`,
    );
  });

  describe('mapShiprocketStatus', () => {
    it('maps the documented provider vocabulary', () => {
      expect(mapShiprocketStatus('DELIVERED')).toBe(ShipmentStatus.delivered);
      expect(mapShiprocketStatus('  picked up ')).toBe(
        ShipmentStatus.picked_up,
      );
      expect(mapShiprocketStatus('Shipped')).toBe(ShipmentStatus.in_transit);
      expect(mapShiprocketStatus('RTO Initiated')).toBe(ShipmentStatus.rto);
      expect(mapShiprocketStatus('CANCELED')).toBe(ShipmentStatus.cancelled);
      expect(mapShiprocketStatus('LABEL GENERATED')).toBe(
        ShipmentStatus.awb_assigned,
      );
    });

    it('treats an absent status as pending and an unknown one as failed', () => {
      expect(mapShiprocketStatus(null)).toBe(ShipmentStatus.pending);
      expect(mapShiprocketStatus(undefined)).toBe(ShipmentStatus.pending);
      expect(mapShiprocketStatus('')).toBe(ShipmentStatus.pending);
      expect(mapShiprocketStatus('SOMETHING NEW')).toBe(ShipmentStatus.failed);
    });
  });

  // ---- failure modes ----------------------------------------------------

  it('throws ServiceUnavailable when Shiprocket is down', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'boom' }, false, 500),
    );
    await expect(adapter.track('AWB123')).rejects.toThrow(/Shiprocket/);
  });

  it('does not retry a 4xx that is not a 401', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Invalid pickup location' }, false, 422),
    );

    await expect(adapter.createShipment(DRAFT)).rejects.toThrow(
      /orders\/create\/adhoc failed \(422\)/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redisClient.del).not.toHaveBeenCalled();
  });

  it('converts a transport failure into ServiceUnavailable', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    const error = await adapter.track('AWB123').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as Error).message).toMatch(/unreachable/);
  });

  it('converts an abort/timeout into ServiceUnavailable', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      }),
    );
    await expect(adapter.getLabel(REF)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('converts a malformed JSON body into ServiceUnavailable', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      text: () => Promise.resolve('<html/>'),
    } as unknown as Response);

    await expect(adapter.track('AWB123')).rejects.toThrow(/malformed response/);
  });

  it('sends an abort signal on every request', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await adapter.track('AWB1');
    const [, init] = callAt(fetchMock, 0);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
