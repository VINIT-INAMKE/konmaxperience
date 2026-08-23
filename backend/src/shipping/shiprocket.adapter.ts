import {
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShippingProvider as ShippingProviderName } from '@prisma/client';
import { RedisService } from '../customer-auth/redis.service';
import {
  SHIPROCKET_BASE_URL,
  SHIPROCKET_TIMEOUT_MS,
  SHIPROCKET_TOKEN_KEY,
  SHIPROCKET_TOKEN_TTL_SECONDS,
  mapShiprocketStatus,
} from './shipping.constants';
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
 * The one HTTP seam of this module. Injecting it (or reassigning `global.fetch`)
 * is what keeps every jest run off the network.
 */
export type ShippingFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

/** DI token for {@link ShippingFetch}; optional — the adapter falls back to `fetch`. */
export const SHIPPING_FETCH = Symbol('SHIPPING_FETCH');

/**
 * SPEC §5.3 — Shiprocket public API v1 (`apiv2.shiprocket.in/v1/external`).
 *
 * Endpoint map: `POST auth/login` · `GET courier/serviceability/` ·
 * `POST orders/create/adhoc` · `POST courier/assign/awb` ·
 * `POST courier/generate/pickup` · `POST courier/generate/label` ·
 * `GET courier/track/awb/{awb}` · `POST orders/cancel`.
 *
 * Auth token is cached in Redis for ~9 days and refreshed once on a 401.
 * Every failure — HTTP, transport, timeout or malformed body — surfaces as a
 * `ServiceUnavailableException`, so the port contract ("resolves or throws a
 * Nest HTTP exception") holds for callers.
 */
@Injectable()
export class ShiprocketAdapter implements ShippingProviderPort {
  readonly name = ShippingProviderName.shiprocket;
  private readonly logger = new Logger(ShiprocketAdapter.name);
  /** In-process fallback when Redis is unavailable — the token still gets reused per boot. */
  private memoryToken: string | null = null;
  private readonly fetchImpl: ShippingFetch;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @Optional() @Inject(SHIPPING_FETCH) fetchImpl?: ShippingFetch,
  ) {
    // Late-bound on purpose: resolving `fetch` per call lets a spec swap
    // `global.fetch` after the adapter is constructed.
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  private get baseUrl(): string {
    return (
      this.config.get<string>('SHIPROCKET_BASE_URL') ?? SHIPROCKET_BASE_URL
    );
  }

  // ---- auth -------------------------------------------------------------
  private async login(): Promise<string> {
    const email = this.config.get<string>('SHIPROCKET_EMAIL');
    const password = this.config.get<string>('SHIPROCKET_PASSWORD');
    if (!email || !password) {
      throw new ServiceUnavailableException(
        'Shiprocket credentials are not configured',
      );
    }
    const res = await this.rawFetch('auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await this.parseJson<{ token?: string }>(res, 'auth/login');
    if (!res.ok || !body.token) {
      throw new ServiceUnavailableException(
        `Shiprocket login failed (${res.status})`,
      );
    }
    this.memoryToken = body.token;
    await this.redis
      .getClient()
      ?.setex(SHIPROCKET_TOKEN_KEY, SHIPROCKET_TOKEN_TTL_SECONDS, body.token);
    return body.token;
  }

  private async token(): Promise<string> {
    const cached = await this.redis.getClient()?.get(SHIPROCKET_TOKEN_KEY);
    if (cached) return cached;
    if (this.memoryToken) return this.memoryToken;
    return this.login();
  }

  private async invalidateToken(): Promise<void> {
    this.memoryToken = null;
    await this.redis.getClient()?.del(SHIPROCKET_TOKEN_KEY);
  }

  // ---- transport --------------------------------------------------------
  private async rawFetch(path: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}/${path}`, {
        ...init,
        signal: AbortSignal.timeout(SHIPROCKET_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Shiprocket ${path} transport error: ${message}`);
      throw new ServiceUnavailableException(
        `Shiprocket ${path} is unreachable (${message})`,
      );
    }
  }

  private async parseJson<T>(res: Response, path: string): Promise<T> {
    try {
      return (await res.json()) as T;
    } catch {
      throw new ServiceUnavailableException(
        `Shiprocket ${path} returned a malformed response`,
      );
    }
  }

  /**
   * Authenticated call with exactly one re-auth retry on 401. The retry reuses the
   * token `login()` just returned rather than re-reading Redis, so a concurrent
   * writer cannot hand the retry the stale token it was meant to replace.
   */
  private async call<T>(
    path: string,
    init: RequestInit = {},
    forcedToken?: string,
  ): Promise<T> {
    const token = forcedToken ?? (await this.token());
    const res = await this.rawFetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 401 && !forcedToken) {
      await this.invalidateToken();
      const fresh = await this.login();
      return this.call<T>(path, init, fresh);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Shiprocket ${path} failed ${res.status}: ${text.slice(0, 400)}`,
      );
      throw new ServiceUnavailableException(
        `Shiprocket ${path} failed (${res.status})`,
      );
    }
    return this.parseJson<T>(res, path);
  }

  // ---- ShippingProviderPort --------------------------------------------
  async checkServiceability(
    req: ServiceabilityRequest,
  ): Promise<ServiceabilityResult> {
    const query = new URLSearchParams({
      pickup_postcode: req.pickup_pincode,
      delivery_postcode: req.delivery_pincode,
      weight: (req.weight_grams / 1000).toFixed(3),
      cod: '0',
      declared_value: (req.declared_value_paise / 100).toFixed(2),
    });
    const body = await this.call<{
      data?: {
        available_courier_companies?: Array<{
          courier_name: string;
          courier_company_id: number;
          rate: number;
          etd?: string;
        }>;
      };
    }>(`courier/serviceability/?${query.toString()}`, { method: 'GET' });

    const options = body.data?.available_courier_companies ?? [];
    if (options.length === 0) {
      return {
        serviceable: false,
        rate: 0,
        courier_name: null,
        courier_id: null,
        etd: null,
        reason: 'No courier serves this pincode',
      };
    }
    const cheapest = options.reduce(
      (best, c) => (c.rate < best.rate ? c : best),
      options[0],
    );
    return {
      serviceable: true,
      rate: Math.round(cheapest.rate * 100), // rupees -> paise
      courier_name: cheapest.courier_name,
      courier_id: String(cheapest.courier_company_id),
      etd: cheapest.etd ? new Date(cheapest.etd.replace(' ', 'T')) : null,
    };
  }

  async createShipment(draft: ShipmentDraft): Promise<CreateShipmentResult> {
    const body = await this.call<{ order_id?: number; shipment_id?: number }>(
      'orders/create/adhoc',
      {
        method: 'POST',
        body: JSON.stringify({
          order_id: String(draft.order_number),
          order_date: draft.order_placed_at
            .toISOString()
            .slice(0, 16)
            .replace('T', ' '),
          pickup_location: draft.pickup_location_code,
          billing_customer_name: draft.billing.name,
          billing_last_name: '',
          billing_address: draft.billing.address,
          billing_address_2: draft.billing.landmark ?? '',
          billing_city: draft.billing.city,
          billing_pincode: draft.billing.pincode,
          billing_state: draft.billing.state,
          billing_country: 'India',
          billing_email: draft.billing.email ?? '',
          billing_phone: draft.billing.phone,
          shipping_is_billing: true,
          order_items: draft.lines.map((l) => ({
            name: l.name,
            sku: l.sku,
            units: l.quantity,
            selling_price: (l.unit_price / 100).toFixed(2),
            hsn: l.hsn_code ?? '',
          })),
          payment_method: 'Prepaid',
          sub_total: (draft.sub_total_paise / 100).toFixed(2),
          length: draft.dimensions_cm.length,
          breadth: draft.dimensions_cm.breadth,
          height: draft.dimensions_cm.height,
          weight: (draft.weight_grams / 1000).toFixed(3),
        }),
      },
    );
    return {
      provider_order_id: body.order_id ? String(body.order_id) : null,
      provider_shipment_id: body.shipment_id ? String(body.shipment_id) : null,
    };
  }

  async assignAwb(ref: ShipmentRef): Promise<AssignAwbResult> {
    const body = await this.call<{
      response?: {
        data?: {
          awb_code?: string;
          courier_name?: string;
          courier_company_id?: number;
        };
      };
    }>('courier/assign/awb', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: ref.provider_shipment_id }),
    });
    const data = body.response?.data;
    return {
      awb: data?.awb_code ?? null,
      courier_name: data?.courier_name ?? null,
      courier_id: data?.courier_company_id
        ? String(data.courier_company_id)
        : null,
    };
  }

  async schedulePickup(ref: ShipmentRef): Promise<SchedulePickupResult> {
    const body = await this.call<{
      pickup_token_number?: string;
      pickup_scheduled_date?: string;
    }>('courier/generate/pickup', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: [ref.provider_shipment_id] }),
    });
    return {
      scheduled: true,
      pickup_token: body.pickup_token_number ?? null,
      pickup_scheduled_date: body.pickup_scheduled_date
        ? new Date(body.pickup_scheduled_date)
        : null,
    };
  }

  async getLabel(ref: ShipmentRef): Promise<LabelResult> {
    const body = await this.call<{ label_url?: string }>(
      'courier/generate/label',
      {
        method: 'POST',
        body: JSON.stringify({ shipment_id: [ref.provider_shipment_id] }),
      },
    );
    return { label_url: body.label_url ?? null };
  }

  async track(awb: string): Promise<TrackResult> {
    const body = await this.call<{
      tracking_data?: {
        track_url?: string;
        shipment_track?: Array<{
          courier_name?: string;
          current_status?: string;
        }>;
        shipment_track_activities?: Array<{
          status?: string;
          date?: string;
          activity?: string;
        }>;
      };
    }>(`courier/track/awb/${encodeURIComponent(awb)}`, { method: 'GET' });

    const data = body.tracking_data;
    const head = data?.shipment_track?.[0];
    return {
      status: mapShiprocketStatus(head?.current_status),
      courier_name: head?.courier_name ?? null,
      tracking_url: data?.track_url ?? null,
      events: (data?.shipment_track_activities ?? []).map((a) => ({
        status: mapShiprocketStatus(a.status),
        occurred_at: a.date ? new Date(a.date.replace(' ', 'T')) : new Date(),
        raw: a,
      })),
    };
  }

  async cancel(ref: ShipmentRef): Promise<CancelResult> {
    await this.call('orders/cancel', {
      method: 'POST',
      body: JSON.stringify({ ids: [Number(ref.provider_order_id)] }),
    });
    return { cancelled: true };
  }
}
