import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  FulfilmentType,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../chat/pusher.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { OrderLifecycleService } from '../orders/order-lifecycle.service';
import { WhatsAppService } from '../customer-auth/whatsapp.service';
import { mapShiprocketStatus } from '../shipping/shipping.constants';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  systemActor,
  type DomainEventPayload,
} from '../common/events/domain-events';

/** One line of Shiprocket's tracking history. Every field is best-effort. */
export interface ShiprocketScan {
  date?: string;
  activity?: string;
  status?: string;
  location?: string;
}

/**
 * Shiprocket's tracking webhook body — the documented fields we rely on. The
 * index signature is deliberate: the payload is stored verbatim in
 * `ShipmentEvent.raw`, so unknown keys must survive rather than be stripped.
 */
export interface ShiprocketWebhookBody {
  awb?: string | number;
  current_status?: string;
  current_status_id?: number;
  order_id?: string | number;
  courier_name?: string;
  etd?: string;
  current_timestamp?: string;
  scans?: ShiprocketScan[];
  [key: string]: unknown;
}

export type ShiprocketWebhookResult =
  | { status: 'ignored'; reason: string }
  | {
      status: 'ok';
      shipment_status: ShipmentStatus;
      order_delivered: boolean;
    };

/** The shape `ShipmentsService.findByAwb` hands back, kept in sync by inference. */
type ShipmentWithOrder = NonNullable<
  Awaited<ReturnType<ShipmentsService['findByAwb']>>
>;

/**
 * Item states that need nothing further before an order can be called
 * delivered: shipped lines that landed, event lines that were attended, lines
 * that were cancelled, and local lines the kitchen has already finished.
 */
const SETTLED_ITEM_STATUSES: readonly OrderItemStatus[] = [
  OrderItemStatus.delivered,
  OrderItemStatus.attended,
  OrderItemStatus.cancelled,
  OrderItemStatus.ready,
];

/** Orders a late courier scan must never drag forward into `delivered`. */
const CLOSED_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.delivered,
  OrderStatus.completed,
  OrderStatus.cancelled,
  OrderStatus.refunded,
];

export const CUSTOMER_CHANNEL_PREFIX = 'private-customer-';
export const CUSTOMER_SHIPMENT_EVENT = 'shipment.updated';
export const SHIPMENT_WHATSAPP_TEMPLATE = 'shipment_update';

/**
 * Shiprocket stamps `"2026-08-24 09:15:00"` — a space-separated, timezone-less
 * local time that `new Date()` parses inconsistently across engines, so the
 * space becomes a `T`. An unparseable value falls back to "now": an
 * `Invalid Date` would poison `ShipmentEvent`'s `(shipment, status, occurred_at)`
 * unique key and break replay de-duplication.
 */
export function parseShiprocketTimestamp(raw: string | undefined): Date {
  if (!raw) return new Date();
  const parsed = new Date(raw.trim().replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * SHIP-04 / SHIP-05 — `POST /webhooks/shiprocket`.
 *
 * Division of labour with {@link ShipmentsService.applyStatus}, which is the
 * single writer of `Shipment.status`:
 *
 * - `applyStatus` owns the transition guard, the `ShipmentEvent` ledger row, the
 *   audit entry, the `placed -> shipped` order promotion, the staff Pusher
 *   broadcast and the `shipment.status_changed` domain event. **None of that is
 *   repeated here.**
 * - This service owns everything a courier callback adds on top: the
 *   shared-secret check, AWB resolution, the provider-string mapping, and the
 *   `delivered` fan-out (order items -> `delivered`, order -> `delivered`,
 *   `shipment.delivered` + `order.delivered`, customer notification).
 *
 * **Idempotency.** Shiprocket retries any non-2xx, so every path that is not a
 * bug answers `200`: an unknown AWB, a body with no AWB and a scan that would
 * move the parcel backwards are all `{ status: 'ignored' }`. A replay of a scan
 * we already hold is a no-op twice over — `applyStatus` upserts the same ledger
 * row on `@@unique([shipment_id, status, occurred_at])` and short-circuits the
 * `from === to` transition, and the fan-out below runs only on the *transition*
 * into `delivered`, never on a repeat of it.
 */
@Injectable()
export class ShiprocketWebhookService {
  private readonly logger = new Logger(ShiprocketWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly shipments: ShipmentsService,
    private readonly pusher: PusherService,
    private readonly whatsapp: WhatsAppService,
    private readonly eventEmitter: EventEmitter2,
    private readonly lifecycle: OrderLifecycleService,
  ) {}

  /**
   * SPEC §5.3 — a shared-secret header, compared in constant time (plan
   * decision 9). `main.ts` preserves `rawBody` only for `/webhooks/razorpay`,
   * so a body HMAC is not available here and is not what SPEC asks for.
   *
   * The length comparison happens first because `timingSafeEqual` *throws* on
   * mismatched buffer lengths; the branch leaks the secret's length, which is
   * not a secret, and nothing else.
   */
  assertAuthorised(token: string | undefined): void {
    const expected = this.config.get<string>('SHIPROCKET_WEBHOOK_TOKEN');
    if (!expected) {
      throw new ForbiddenException('Shiprocket webhook is not configured');
    }
    const provided = Buffer.from(token ?? '', 'utf8');
    const secret = Buffer.from(expected, 'utf8');
    if (
      provided.length !== secret.length ||
      !timingSafeEqual(provided, secret)
    ) {
      throw new UnauthorizedException('Invalid webhook token');
    }
  }

  async handle(
    token: string | undefined,
    body: ShiprocketWebhookBody,
  ): Promise<ShiprocketWebhookResult> {
    this.assertAuthorised(token);

    const awb = readAwb(body.awb);
    if (!awb) return { status: 'ignored', reason: 'no awb' };

    const shipment = await this.shipments.findByAwb(awb);
    if (!shipment) {
      // A parcel we never packed, or one belonging to another environment
      // sharing the Shiprocket account. 200 or Shiprocket retries forever.
      this.logger.warn(`Shiprocket webhook for unknown AWB ${awb}`);
      return { status: 'ignored', reason: 'unknown awb' };
    }

    const next = mapShiprocketStatus(body.current_status);
    const occurredAt = parseShiprocketTimestamp(body.current_timestamp);
    // Read before the write: this is what makes the `delivered` fan-out fire
    // exactly once, on the transition rather than on every redelivery.
    const changed = shipment.status !== next;

    try {
      await this.shipments.applyStatus(
        shipment.id,
        next,
        occurredAt,
        body as unknown as Prisma.InputJsonValue,
        systemActor(),
      );
    } catch (err) {
      if (err instanceof BadRequestException) {
        // Out-of-order scan (a `failed` after `delivered`, a courier replaying
        // an old leg). The ledger keeps history; refusing the callback would
        // only earn an infinite retry.
        this.logger.warn(
          `Shiprocket webhook for AWB ${awb} rejected: ${shipment.status} -> ${next} is not a legal transition`,
        );
        return { status: 'ignored', reason: 'invalid transition' };
      }
      throw err;
    }

    const orderDelivered =
      changed && next === ShipmentStatus.delivered
        ? await this.fanOutDelivered(shipment)
        : false;

    this.notifyCustomer(
      shipment,
      next,
      awb,
      body.courier_name ?? shipment.courier_name,
      changed,
    );

    return {
      status: 'ok',
      shipment_status: next,
      order_delivered: orderDelivered,
    };
  }

  /**
   * SHIP-04 — the `delivered` fan-out.
   *
   * `applyStatus` deliberately stops at `shipped`: only the caller that knows
   * the whole parcel landed can decide whether the *order* is finished. Local
   * lines are untouched — a mixed order reaches `delivered` only when every
   * remaining line is already settled, which is exactly what the outstanding
   * count proves.
   *
   * @returns whether this call is the one that moved the order to `delivered`.
   */
  private async fanOutDelivered(shipment: ShipmentWithOrder): Promise<boolean> {
    const orderId = shipment.order_id;

    const order = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { order_id: orderId, fulfilment: FulfilmentType.shipped },
        data: { status: OrderItemStatus.delivered },
      });

      const outstanding = await tx.orderItem.count({
        where: {
          order_id: orderId,
          status: { notIn: [...SETTLED_ITEM_STATUSES] },
        },
      });
      if (outstanding > 0) return null;

      // `updateMany` with a status guard, not `update`: a cancelled or refunded
      // order must not be dragged forward, and the returned count is the proof
      // that `order.delivered` is ours to emit rather than a duplicate.
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: { notIn: [...CLOSED_ORDER_STATUSES] } },
        data: { status: OrderStatus.delivered },
      });
      if (count === 0) return null;

      return tx.order.findUnique({
        where: { id: orderId },
        select: { order_number: true, channel: true, total: true },
      });
    });

    const shipmentDelivered: DomainEventPayload<
      typeof DomainEvent.SHIPMENT_DELIVERED
    > = {
      ...domainEventBase(shipment.node_id, systemActor()),
      shipmentId: shipment.id,
      orderId,
      awb: shipment.awb,
    };
    emitDomainEvent(
      this.eventEmitter,
      DomainEvent.SHIPMENT_DELIVERED,
      shipmentDelivered,
    );

    if (!order) return false;

    const orderDelivered: DomainEventPayload<
      typeof DomainEvent.ORDER_DELIVERED
    > = {
      ...domainEventBase(shipment.node_id, systemActor()),
      orderId,
      orderNumber: order.order_number,
      channel: order.channel,
      total: order.total.toString(),
    };
    emitDomainEvent(
      this.eventEmitter,
      DomainEvent.ORDER_DELIVERED,
      orderDelivered,
    );
    // p5a-15 seam: the fan-out writes Order.status directly, so the loyalty
    // credit must be triggered explicitly. onDelivered never throws and is
    // exactly-once on (order_id, reason).
    await this.lifecycle.onDelivered(orderId, systemActor());
    return true;
  }

  /**
   * SHIP-05 — the customer's half of the notification. Both sends are
   * failure-isolated: the transaction has already committed, so a dead socket
   * must not turn a recorded delivery into a 500 and an infinite retry.
   *
   * The Pusher broadcast fires on every callback (it only refreshes a screen);
   * the WhatsApp template fires **only on an actual transition**, so Shiprocket
   * redelivering the same scan cannot spam the customer.
   */
  private notifyCustomer(
    shipment: ShipmentWithOrder,
    next: ShipmentStatus,
    awb: string,
    courier: string | null,
    changed: boolean,
  ): void {
    const customerId = shipment.order.customer_id;
    if (customerId) {
      this.failureIsolated(
        this.pusher.trigger(
          `${CUSTOMER_CHANNEL_PREFIX}${customerId}`,
          CUSTOMER_SHIPMENT_EVENT,
          {
            orderId: shipment.order_id,
            shipmentId: shipment.id,
            status: next,
            awb,
            courier,
            trackingUrl: shipment.tracking_url,
          },
        ),
        `Pusher ${CUSTOMER_SHIPMENT_EVENT} failed for shipment ${shipment.id}`,
      );
    }

    const notifiable =
      next === ShipmentStatus.delivered ||
      next === ShipmentStatus.out_for_delivery;
    const phone = shipment.order.customer_phone;
    if (changed && notifiable && phone) {
      this.failureIsolated(
        this.whatsapp.sendTemplate(phone, SHIPMENT_WHATSAPP_TEMPLATE, [
          String(next),
          awb,
          courier ?? '',
        ]),
        `WhatsApp ${SHIPMENT_WHATSAPP_TEMPLATE} failed for shipment ${shipment.id}`,
      );
    }
  }

  /** Fire-and-forget with a log line — never rethrows, never returns a rejection. */
  private failureIsolated(work: unknown, label: string): void {
    void Promise.resolve(work).catch((err: unknown) =>
      this.logger.warn(`${label}: ${String(err)}`),
    );
  }
}

/** Shiprocket sends the AWB as a string on most events and a number on some. */
function readAwb(raw: string | number | undefined): string | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : null;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}
