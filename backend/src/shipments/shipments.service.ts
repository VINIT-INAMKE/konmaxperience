import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  FulfilmentType,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ShipmentStatus,
  ShippingProvider as ShippingProviderName,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { ShippingProviderResolver } from '../shipping/shipping-provider.resolver';
import type {
  ShipmentDraft,
  ShipmentDraftLine,
  ShipmentRef,
} from '../shipping/shipping.types';
import { PusherService } from '../chat/pusher.service';
import type { Tx } from '../common/types/transaction';
import {
  SERIALIZABLE_TX_OPTIONS,
  hasPrismaCode,
  withSerializableRetry,
} from '../common/utils/transaction-retry';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  type DomainEventActor,
  type DomainEventPayload,
} from '../common/events/domain-events';
import { toPaise } from '../common/money/money';
import { PackShipmentDto } from './dto/pack-shipment.dto';
import { ManualAwbDto } from './dto/manual-awb.dto';

const DEFAULT_PAGE = 50;
const MAX_PAGE = 200;

/** The staff realtime channel every shipment transition is broadcast on. */
export const SHIPMENTS_CHANNEL = 'private-shipments';
export const SHIPMENT_UPDATED_EVENT = 'shipment.updated';

/**
 * Columns a transition is allowed to carry with it. `applyStatus` is the only
 * writer of `Shipment.status`, so anything a provider hands back — an AWB, a
 * courier name, a label — rides along in the same update rather than needing a
 * second write that could interleave with the webhook.
 */
export interface ShipmentPatch {
  provider_order_id?: string | null;
  provider_shipment_id?: string | null;
  awb?: string | null;
  courier_name?: string | null;
  tracking_url?: string | null;
  label_url?: string | null;
  etd?: Date | null;
  cost?: Prisma.Decimal | null;
}

export type ShipmentStatusChangedEvent = DomainEventPayload<
  typeof DomainEvent.SHIPMENT_STATUS_CHANGED
>;

/**
 * `Order.address_snapshot` is written by checkout (Task 9) as a frozen copy of
 * the delivery address. Typed loosely on purpose: it is a `Json` column, so the
 * only honest contract is "these keys may be strings".
 */
interface AddressSnapshot {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  landmark?: unknown;
  city?: unknown;
  state?: unknown;
  pincode?: unknown;
}

const ORDER_FOR_PACK_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  items: { include: { product: true, variant: true } },
};

const SHIPMENT_ORDER_SELECT = {
  id: true,
  order_number: true,
  status: true,
  customer_id: true,
  customer_name: true,
  customer_phone: true,
  delivery_address: true,
  created_at: true,
};

const SHIPPED_ITEMS_INCLUDE = {
  items: {
    where: { fulfilment: FulfilmentType.shipped },
    select: {
      id: true,
      quantity: true,
      status: true,
      unit_price: true,
      product: { select: { id: true, name: true, slug: true } },
      variant: { select: { id: true, name: true, sku: true } },
    },
  },
};

/**
 * SHIP-03 — the staff shipments queue: pack → AWB → pickup → label → cancel.
 *
 * Two invariants hold the module together:
 *
 * 1. **One shipment per order** (`Shipment.order_id @unique`, plan decision 8).
 *    Packing is therefore idempotent *at the database level*: a second pack
 *    collides on the unique index and returns the first row.
 * 2. **One writer of `Shipment.status`** — {@link applyStatus}. Staff actions and
 *    the Shiprocket webhook (Task 12) both funnel through it, so the ledger
 *    (`ShipmentEvent`), the audit trail, the order-status propagation, the Pusher
 *    broadcast and the `shipment.status_changed` domain event cannot diverge
 *    between the two entry points.
 *
 * Every network call to the courier happens **outside** the transaction. A
 * Serializable transaction that waits on an HTTP round-trip holds locks for the
 * length of someone else's outage.
 */
@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  /**
   * Allowed transitions. The explicit map is the SPEC lattice; on top of it any
   * **forward** move along {@link LINEAR_FLOW} is accepted, because couriers
   * routinely skip states (a parcel scanned "SHIPPED" while we still believe it
   * is `awb_assigned`). Rejecting those would 400 the webhook and lose the
   * update; the ledger keeps the full history either way. Backward moves and
   * anything out of a terminal state still throw.
   */
  private static readonly TRANSITIONS: Partial<
    Record<ShipmentStatus, ShipmentStatus[]>
  > = {
    [ShipmentStatus.pending]: [
      ShipmentStatus.awb_assigned,
      ShipmentStatus.cancelled,
      ShipmentStatus.failed,
    ],
    [ShipmentStatus.awb_assigned]: [
      ShipmentStatus.pickup_scheduled,
      ShipmentStatus.cancelled,
      ShipmentStatus.failed,
    ],
    [ShipmentStatus.pickup_scheduled]: [
      ShipmentStatus.picked_up,
      ShipmentStatus.cancelled,
      ShipmentStatus.failed,
    ],
    [ShipmentStatus.picked_up]: [
      ShipmentStatus.in_transit,
      ShipmentStatus.rto,
      ShipmentStatus.failed,
    ],
    [ShipmentStatus.in_transit]: [
      ShipmentStatus.out_for_delivery,
      ShipmentStatus.rto,
      ShipmentStatus.failed,
    ],
    [ShipmentStatus.out_for_delivery]: [
      ShipmentStatus.delivered,
      ShipmentStatus.rto,
      ShipmentStatus.failed,
    ],
  };

  /** The happy path, in order. Membership + index comparison = "is this forward?". */
  private static readonly LINEAR_FLOW: readonly ShipmentStatus[] = [
    ShipmentStatus.pending,
    ShipmentStatus.awb_assigned,
    ShipmentStatus.pickup_scheduled,
    ShipmentStatus.picked_up,
    ShipmentStatus.in_transit,
    ShipmentStatus.out_for_delivery,
    ShipmentStatus.delivered,
  ];

  /** A parcel that is moving means the order is `shipped`, whatever leg it is on. */
  private static readonly IN_FLIGHT: readonly ShipmentStatus[] = [
    ShipmentStatus.picked_up,
    ShipmentStatus.in_transit,
    ShipmentStatus.out_for_delivery,
  ];

  /** Orders past shipping: a courier scan must never drag them backwards. */
  private static readonly ORDER_TERMINAL: readonly OrderStatus[] = [
    OrderStatus.shipped,
    OrderStatus.delivered,
    OrderStatus.completed,
    OrderStatus.cancelled,
    OrderStatus.refunded,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly providers: ShippingProviderResolver,
    private readonly audit: AuditService,
    private readonly pusher: PusherService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── reads ────────────────────────────────────────────────────────────────

  /** `GET /shipments?status=&cursor=&limit=` — the ops queue, newest first. */
  async list(status?: ShipmentStatus, cursor?: string, limit = DEFAULT_PAGE) {
    const take = Math.min(Number(limit) || DEFAULT_PAGE, MAX_PAGE);
    // One extra row answers "is there a next page?" without a COUNT over a
    // table that grows with every parcel.
    const rows = await this.prisma.shipment.findMany({
      where: status ? { status } : {},
      orderBy: { created_at: 'desc' },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        order: {
          select: { ...SHIPMENT_ORDER_SELECT, ...SHIPPED_ITEMS_INCLUDE },
        },
      },
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      next_cursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  /** `GET /shipments/:id` — the row plus its full tracking ledger. */
  async findOne(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        order: {
          select: { ...SHIPMENT_ORDER_SELECT, ...SHIPPED_ITEMS_INCLUDE },
        },
        events: { orderBy: { occurred_at: 'desc' } },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  /**
   * SHIP-05 — the storefront's view of a parcel, for
   * `GET /customer/orders/:id/shipment` (Task 9 owns the controller and the
   * ownership check; this method is deliberately id-only so it cannot be the
   * place an authorisation bug lands).
   *
   * `null` when the order has no shipped lines, which is exactly when no
   * `Shipment` row exists.
   */
  async findForOrder(orderId: string) {
    return this.prisma.shipment.findUnique({
      where: { order_id: orderId },
      include: {
        events: {
          orderBy: { occurred_at: 'desc' },
          select: { status: true, occurred_at: true },
        },
      },
    });
  }

  /** Task 12's entry point: the Shiprocket webhook identifies a parcel by AWB. */
  async findByAwb(awb: string) {
    return this.prisma.shipment.findUnique({
      where: { awb },
      include: { order: { select: SHIPMENT_ORDER_SELECT } },
    });
  }

  // ─── staff actions ────────────────────────────────────────────────────────

  /**
   * SHIP-03 "pack": turns every `fulfilment = shipped` line of an order into one
   * `Shipment`.
   *
   * The courier's `createShipment` call happens *before* the transaction and is
   * failure-isolated: packing is a physical act that has already happened by the
   * time staff press the button, so an unreachable provider must not lose it.
   * `assignAwb` retries the registration when `provider_order_id` is still null.
   */
  async pack(dto: PackShipmentDto, userId: string) {
    const orderId = dto.order_id;

    // Idempotent fast path — cheaper than provoking the unique violation, and it
    // skips the provider round-trip entirely on a double-click.
    const existing = await this.prisma.shipment.findUnique({
      where: { order_id: orderId },
    });
    if (existing) return existing;

    const cfg = await this.settings.get('shipping');
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_FOR_PACK_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');

    const shippedItems = order.items.filter(
      (item) => item.fulfilment === FulfilmentType.shipped,
    );
    if (shippedItems.length === 0) {
      throw new BadRequestException('This order has no shipped items');
    }

    const catalogWeight = shippedItems.reduce(
      (total, item) => total + (item.product.weight_grams ?? 0) * item.quantity,
      0,
    );
    // One resolved figure, so the courier's draft and the stored row can never
    // disagree about how heavy the parcel is.
    const weightGrams =
      dto.weight_grams ?? (catalogWeight || cfg.default_weight_grams);
    const pickupCode = dto.pickup_location_code ?? cfg.pickup_location_code;

    const provider = await this.providers.get();
    const registration = await this.register(
      provider.name,
      () =>
        provider.createShipment(
          this.buildDraft(order, shippedItems, weightGrams, pickupCode, cfg),
        ),
      orderId,
    );

    try {
      const shipment = await withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) =>
            this.packInTx(tx, orderId, shippedItems, userId, {
              provider: cfg.provider as ShippingProviderName,
              pickup_location_code: pickupCode,
              weight_grams: weightGrams,
              provider_order_id: registration?.provider_order_id ?? null,
              provider_shipment_id: registration?.provider_shipment_id ?? null,
            }),
          SERIALIZABLE_TX_OPTIONS,
        ),
      );
      await this.notify(shipment);
      return shipment;
    } catch (err) {
      // `Shipment.order_id @unique` is the idempotency key (decision 8): a
      // concurrent pack won the race, so return its row rather than erroring.
      if (hasPrismaCode(err, 'P2002')) {
        return this.prisma.shipment.findUniqueOrThrow({
          where: { order_id: orderId },
        });
      }
      throw err;
    }
  }

  /**
   * SHIP-03 "AWB". The provider is asked first and its answer wins; the pasted
   * body is the fallback that makes the `manual` provider usable at all.
   */
  async assignAwb(id: string, dto: ManualAwbDto, userId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { order: { include: ORDER_FOR_PACK_INCLUDE } },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    this.assertTransition(shipment.status, ShipmentStatus.awb_assigned);

    const provider = await this.providers.get();
    let providerOrderId = shipment.provider_order_id;
    let providerShipmentId = shipment.provider_shipment_id;

    // Registration is retried here when pack could not reach the courier.
    if (!providerOrderId && !providerShipmentId) {
      const cfg = await this.settings.get('shipping');
      const shippedItems = shipment.order.items.filter(
        (item) => item.fulfilment === FulfilmentType.shipped,
      );
      const created = await provider.createShipment(
        this.buildDraft(
          shipment.order,
          shippedItems,
          shipment.weight_grams,
          shipment.pickup_location_code,
          cfg,
        ),
      );
      providerOrderId = created.provider_order_id;
      providerShipmentId = created.provider_shipment_id;
    }

    const issued = await provider.assignAwb({
      provider_order_id: providerOrderId,
      provider_shipment_id: providerShipmentId,
      awb: shipment.awb,
    });

    const awb = issued.awb ?? dto.awb?.trim() ?? shipment.awb;
    if (!awb) {
      throw new BadRequestException(
        'No AWB was issued — paste the courier’s AWB or configure a provider that issues one',
      );
    }

    return this.applyStatus(
      id,
      ShipmentStatus.awb_assigned,
      new Date(),
      { source: 'staff.awb', provider: provider.name },
      AuditService.user(userId),
      {
        provider_order_id: providerOrderId,
        provider_shipment_id: providerShipmentId,
        awb,
        courier_name:
          issued.courier_name ?? dto.courier_name ?? shipment.courier_name,
        tracking_url: dto.tracking_url ?? shipment.tracking_url,
      },
    );
  }

  /** SHIP-03 "pickup". Requires an assigned AWB — the courier has nothing to collect without one. */
  async schedulePickup(id: string, userId: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (!shipment.awb) {
      throw new BadRequestException('Assign an AWB before scheduling a pickup');
    }
    this.assertTransition(shipment.status, ShipmentStatus.pickup_scheduled);

    const provider = await this.providers.get();
    const pickup = await provider.schedulePickup(this.ref(shipment));
    if (!pickup.scheduled) {
      throw new BadRequestException(
        'The courier refused the pickup — try again once the parcel is ready',
      );
    }

    return this.applyStatus(
      id,
      ShipmentStatus.pickup_scheduled,
      new Date(),
      { source: 'staff.pickup', pickup_token: pickup.pickup_token },
      AuditService.user(userId),
      { etd: pickup.pickup_scheduled_date ?? shipment.etd },
    );
  }

  /**
   * SHIP-03 "label". Not a status transition — a label can be reprinted at any
   * point after the AWB exists — so the URL is cached on the row and the
   * provider is only asked once.
   */
  async getLabel(
    id: string,
    userId: string,
  ): Promise<{ label_url: string | null }> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (!shipment.awb) {
      throw new BadRequestException('Assign an AWB before printing a label');
    }
    if (shipment.label_url) return { label_url: shipment.label_url };

    const provider = await this.providers.get();
    const { label_url: labelUrl } = await provider.getLabel(this.ref(shipment));
    if (!labelUrl) return { label_url: null };

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id },
        data: { label_url: labelUrl },
      });
      await this.audit.record(tx, {
        entity_type: 'shipment',
        entity_id: id,
        action: 'shipment.label_generated',
        node_id: shipment.node_id,
        ...AuditService.user(userId),
        after: { label_url: labelUrl },
      });
    });
    return { label_url: labelUrl };
  }

  /** SHIP-03 "cancel". Terminal states have no outgoing edge, so a delivered parcel throws. */
  async cancel(id: string, reason: string | undefined, userId: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    this.assertTransition(shipment.status, ShipmentStatus.cancelled);

    const provider = await this.providers.get();
    const result = await provider.cancel(this.ref(shipment));
    if (!result.cancelled) {
      throw new BadRequestException(
        result.reason ?? 'The courier refused the cancellation',
      );
    }

    return this.applyStatus(
      id,
      ShipmentStatus.cancelled,
      new Date(),
      { source: 'staff.cancel', reason: reason ?? null },
      AuditService.user(userId),
    );
  }

  // ─── the single write path ────────────────────────────────────────────────

  /**
   * The only writer of `Shipment.status` — staff actions above **and** the
   * Shiprocket webhook (Task 12) call this, so the ledger row, the audit event,
   * the order propagation, the Pusher broadcast and the domain event are written
   * once, in one place, in that order.
   *
   * Idempotent on `@@unique([shipment_id, status, occurred_at])` (SHIP-04): a
   * replayed webhook upserts the same ledger row and changes nothing. The upsert
   * is deliberate — a `create` that trips P2002 aborts the whole Postgres
   * transaction, which would roll back the status update it was meant to record.
   */
  async applyStatus(
    id: string,
    next: ShipmentStatus,
    occurredAt: Date,
    raw: Prisma.InputJsonValue | null,
    actor: DomainEventActor,
    patch: ShipmentPatch = {},
  ) {
    const { shipment, changed } = await withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) =>
          this.applyStatusInTx(tx, id, next, occurredAt, raw, actor, patch),
        SERIALIZABLE_TX_OPTIONS,
      ),
    );

    // After commit, both failure-isolated: a broken socket must not undo a
    // parcel's history.
    await this.notify(shipment);
    if (changed) {
      const event: ShipmentStatusChangedEvent = {
        ...domainEventBase(shipment.node_id, actor),
        shipmentId: shipment.id,
        orderId: shipment.order_id,
        status: shipment.status,
        awb: shipment.awb,
      };
      emitDomainEvent(
        this.eventEmitter,
        DomainEvent.SHIPMENT_STATUS_CHANGED,
        event,
      );
    }
    return shipment;
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private async applyStatusInTx(
    tx: Tx,
    id: string,
    next: ShipmentStatus,
    occurredAt: Date,
    raw: Prisma.InputJsonValue | null,
    actor: DomainEventActor,
    patch: ShipmentPatch,
  ) {
    const current = await tx.shipment.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Shipment not found');
    this.assertTransition(current.status, next);

    const shipment = await tx.shipment.update({
      where: { id },
      data: { ...prune(patch), status: next },
    });

    await tx.shipmentEvent.upsert({
      where: {
        shipment_id_status_occurred_at: {
          shipment_id: id,
          status: next,
          occurred_at: occurredAt,
        },
      },
      create: {
        shipment_id: id,
        status: next,
        occurred_at: occurredAt,
        raw: raw ?? Prisma.JsonNull,
      },
      update: {},
    });

    const changed = current.status !== next;

    // The parcel's own event first, then the order event it causes — so the
    // trail reads in the order the two facts actually happened.
    await this.audit.record(tx, {
      entity_type: 'shipment',
      entity_id: id,
      action: 'shipment.status_changed',
      node_id: shipment.node_id,
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      before: { status: current.status, awb: current.awb },
      after: {
        status: next,
        awb: shipment.awb,
        occurred_at: occurredAt.toISOString(),
      },
    });

    if (changed) {
      await this.propagateToOrder(
        tx,
        shipment.order_id,
        next,
        actor,
        shipment.node_id,
      );
    }

    return { shipment, changed };
  }

  /**
   * A parcel in motion means the order is `shipped`. `delivered` is deliberately
   * **not** handled here: an order is only delivered when every line is, local
   * ones included, which is the Shiprocket webhook's job (Task 12) because it is
   * the only caller that knows the whole order has landed.
   *
   * This write deliberately bypasses `STATUS_TRANSITIONS` — a courier scan is
   * not a staff lifecycle move and must not be refused by the POS state machine
   * — but it is still a change to `Order.status`, so it writes the same
   * `order.status_changed` AuditEvent `OrdersService.updateStatus` writes, in
   * the same transaction. Without it the order's trail jumped from
   * `order.confirmed` straight to a `status_changed` whose `before` was already
   * `shipped`, i.e. the transition that put it there was invisible.
   *
   * The `already shipped` early return matters: `pickup_scheduled`,
   * `in_transit` and `out_for_delivery` are all `IN_FLIGHT`, and without it
   * every courier scan after the first would write a redundant
   * `shipped → shipped` row.
   */
  private async propagateToOrder(
    tx: Tx,
    orderId: string,
    next: ShipmentStatus,
    actor: DomainEventActor,
    nodeId: string,
  ): Promise<void> {
    if (!ShipmentsService.IN_FLIGHT.includes(next)) return;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order || ShipmentsService.ORDER_TERMINAL.includes(order.status))
      return;
    if (order.status === OrderStatus.shipped) return;

    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.shipped },
    });

    await this.audit.record(tx, {
      entity_type: 'order',
      entity_id: orderId,
      action: 'order.status_changed',
      node_id: nodeId,
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      before: { status: order.status },
      after: { status: OrderStatus.shipped },
    });
  }

  private async packInTx(
    tx: Tx,
    orderId: string,
    shippedItems: readonly PackableItem[],
    userId: string,
    data: {
      provider: ShippingProviderName;
      pickup_location_code: string;
      weight_grams: number;
      provider_order_id: string | null;
      provider_shipment_id: string | null;
    },
  ) {
    const shipment = await tx.shipment.create({
      data: {
        order_id: orderId,
        provider: data.provider,
        provider_order_id: data.provider_order_id,
        provider_shipment_id: data.provider_shipment_id,
        status: ShipmentStatus.pending,
        pickup_location_code: data.pickup_location_code,
        weight_grams: data.weight_grams,
        packed_by: userId,
      },
    });

    await tx.shipmentEvent.create({
      data: {
        shipment_id: shipment.id,
        status: ShipmentStatus.pending,
        occurred_at: shipment.created_at,
        raw: { source: 'staff.pack' },
      },
    });

    await tx.orderItem.updateMany({
      where: { id: { in: shippedItems.map((item) => item.id) } },
      data: { status: OrderItemStatus.packed },
    });

    // Tracked merchandise leaves stock when it is packed. `StockMovement`
    // requires a non-nullable `ingredient_id`, and a `ProductVariant` is not an
    // `Ingredient` — so, per the plan's explicit branch, the decrement is
    // recorded in the AuditEvent instead of forging an ingredient movement.
    const decrements: Array<{ variant_id: string; quantity: number }> = [];
    for (const item of shippedItems) {
      if (!item.variant_id) continue;
      await tx.productVariant.update({
        where: { id: item.variant_id },
        data: { stock_on_hand: { decrement: item.quantity } },
      });
      decrements.push({ variant_id: item.variant_id, quantity: item.quantity });
    }

    await this.audit.record(tx, {
      entity_type: 'shipment',
      entity_id: shipment.id,
      action: 'shipment.packed',
      node_id: shipment.node_id,
      ...AuditService.user(userId),
      after: {
        order_id: orderId,
        provider: shipment.provider,
        weight_grams: shipment.weight_grams,
        pickup_location_code: shipment.pickup_location_code,
        item_ids: shippedItems.map((item) => item.id),
        stock_decrements: decrements,
      },
    });

    return shipment;
  }

  /**
   * Registers the parcel with the courier, swallowing the failure. Packing has
   * already happened physically; refusing to record it because Shiprocket is
   * down would lose the fact. `assignAwb` retries the registration.
   */
  private async register(
    providerName: ShippingProviderName,
    call: () => Promise<{
      provider_order_id: string | null;
      provider_shipment_id: string | null;
    }>,
    orderId: string,
  ) {
    if (providerName === ShippingProviderName.manual) return null;
    try {
      return await call();
    } catch (err) {
      this.logger.warn(
        `Courier registration failed while packing order ${orderId}; the AWB step will retry: ${String(err)}`,
      );
      return null;
    }
  }

  private ref(shipment: {
    provider_order_id: string | null;
    provider_shipment_id: string | null;
    awb: string | null;
  }): ShipmentRef {
    return {
      provider_order_id: shipment.provider_order_id,
      provider_shipment_id: shipment.provider_shipment_id,
      awb: shipment.awb,
    };
  }

  /** Staff realtime. Failure-isolated — Pusher is a convenience, not a record. */
  private async notify(shipment: {
    id: string;
    order_id: string;
    status: ShipmentStatus;
    awb: string | null;
    courier_name: string | null;
    tracking_url: string | null;
  }): Promise<void> {
    try {
      await this.pusher.trigger(SHIPMENTS_CHANNEL, SHIPMENT_UPDATED_EVENT, {
        id: shipment.id,
        orderId: shipment.order_id,
        status: shipment.status,
        awb: shipment.awb,
        courierName: shipment.courier_name,
        trackingUrl: shipment.tracking_url,
      });
    } catch (err) {
      this.logger.warn(
        `Pusher ${SHIPMENT_UPDATED_EVENT} failed for shipment ${shipment.id}: ${String(err)}`,
      );
    }
  }

  private assertTransition(from: ShipmentStatus, to: ShipmentStatus): void {
    if (from === to) return;
    if (ShipmentsService.TRANSITIONS[from]?.includes(to)) return;
    const fromIndex = ShipmentsService.LINEAR_FLOW.indexOf(from);
    const toIndex = ShipmentsService.LINEAR_FLOW.indexOf(to);
    if (fromIndex !== -1 && toIndex > fromIndex) return;
    throw new BadRequestException(
      `Cannot move a shipment from ${from} to ${to}`,
    );
  }

  /** Maps an order onto the transport-agnostic {@link ShipmentDraft} the port takes. */
  private buildDraft(
    order: PackableOrder,
    shippedItems: readonly PackableItem[],
    weightGrams: number,
    pickupCode: string,
    cfg: {
      default_dimensions_cm: {
        length: number;
        breadth: number;
        height: number;
      };
    },
  ): ShipmentDraft {
    const snapshot = (order.address_snapshot ?? {}) as AddressSnapshot;
    const lines: ShipmentDraftLine[] = shippedItems.map((item) => ({
      name: item.variant
        ? `${item.product.name} (${item.variant.name})`
        : item.product.name,
      sku: item.variant?.sku ?? item.product.slug,
      quantity: item.quantity,
      unit_price: toPaise(item.unit_price),
      hsn_code: item.product.hsn_code,
    }));

    return {
      order_number: order.order_number,
      order_placed_at: order.created_at,
      pickup_location_code: pickupCode,
      billing: {
        name:
          str(snapshot.name) ??
          order.customer_name ??
          order.customer?.name ??
          '',
        phone:
          str(snapshot.phone) ??
          order.customer_phone ??
          order.customer?.phone ??
          '',
        email: str(snapshot.email) ?? order.customer?.email ?? null,
        address: str(snapshot.address) ?? order.delivery_address ?? '',
        landmark: str(snapshot.landmark) ?? null,
        city: str(snapshot.city) ?? '',
        state: str(snapshot.state) ?? '',
        pincode: str(snapshot.pincode) ?? '',
      },
      lines,
      sub_total_paise: lines.reduce(
        (total, line) => total + line.unit_price * line.quantity,
        0,
      ),
      weight_grams: weightGrams,
      dimensions_cm: cfg.default_dimensions_cm,
    };
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

interface PackableItem {
  id: string;
  quantity: number;
  variant_id: string | null;
  unit_price: Prisma.Decimal;
  fulfilment: FulfilmentType;
  product: { name: string; slug: string; hsn_code: string | null };
  variant: { name: string; sku: string } | null;
}

interface PackableOrder {
  order_number: number;
  created_at: Date;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  address_snapshot: Prisma.JsonValue | null;
  customer: { name: string | null; phone: string; email: string | null } | null;
}

/** `Json` columns hand back `unknown`; only a real string is worth forwarding. */
function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Drops `undefined` keys so a partial patch never overwrites a column with
 * `undefined` — Prisma ignores `undefined`, but an explicit `null` is a *write*,
 * and the difference matters when the webhook patches one field of six.
 */
function prune(patch: ShipmentPatch): ShipmentPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as ShipmentPatch;
}
