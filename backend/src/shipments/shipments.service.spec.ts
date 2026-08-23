import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ActorType,
  FulfilmentType,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ShipmentStatus,
  ShippingProvider as ShippingProviderName,
} from '@prisma/client';
import {
  SHIPMENTS_CHANNEL,
  SHIPMENT_UPDATED_EVENT,
  ShipmentsService,
} from './shipments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditInput } from '../audit/audit.service';
import {
  SETTING_DEFAULTS,
  SettingsService,
} from '../settings/settings.service';
import { ShippingProviderResolver } from '../shipping/shipping-provider.resolver';
import { PusherService } from '../chat/pusher.service';
import { DomainEvent } from '../common/events/domain-events';
import type { ShipmentDraft } from '../shipping/shipping.types';
import { PackShipmentDto } from './dto/pack-shipment.dto';
import { ManualAwbDto } from './dto/manual-awb.dto';
import {
  MockPrisma,
  mockAuditService,
  mockEventEmitter,
  mockPrisma,
  mockPusher,
  mockSettings,
} from '../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-1';

/**
 * The nth argument of the nth call, typed. `jest.Mock['mock']['calls']` is
 * `any[][]`, so every direct index trips four `no-unsafe-*` rules; funnelling
 * them through one helper confines the cast to a single line.
 */
function callArg<T>(fn: jest.Mock, argIndex = 0, callIndex = 0): T {
  return fn.mock.calls[callIndex][argIndex] as T;
}

/** A `ShippingProviderPort` double. Every method resolves; none touches a socket. */
function shippingProvider(
  name: ShippingProviderName = ShippingProviderName.manual,
) {
  return {
    name,
    checkServiceability: jest.fn(),
    createShipment: jest.fn().mockResolvedValue({
      provider_order_id: null,
      provider_shipment_id: null,
    }),
    assignAwb: jest
      .fn()
      .mockResolvedValue({ awb: null, courier_name: null, courier_id: null }),
    schedulePickup: jest.fn().mockResolvedValue({
      scheduled: true,
      pickup_token: null,
      pickup_scheduled_date: null,
    }),
    getLabel: jest.fn().mockResolvedValue({ label_url: null }),
    track: jest.fn(),
    cancel: jest.fn().mockResolvedValue({ cancelled: true }),
  };
}

type ProviderDouble = ReturnType<typeof shippingProvider>;

function shipmentRow(over: Record<string, unknown> = {}) {
  return {
    id: 'ship-1',
    node_id: NODE_ID,
    order_id: 'order-1',
    provider: ShippingProviderName.manual,
    provider_order_id: null as string | null,
    provider_shipment_id: null as string | null,
    awb: null as string | null,
    courier_name: null as string | null,
    status: ShipmentStatus.pending,
    label_url: null as string | null,
    tracking_url: null as string | null,
    pickup_location_code: 'KONMA-VILLA',
    weight_grams: 550,
    cost: null as Prisma.Decimal | null,
    etd: null as Date | null,
    packed_by: USER_ID,
    created_at: new Date('2026-08-24T06:00:00.000Z'),
    updated_at: new Date('2026-08-24T06:00:00.000Z'),
    ...over,
  };
}

/** ₹325 × 2 of shipped merchandise, on a tracked variant weighing 250 g. */
function shippedItem(over: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    order_id: 'order-1',
    product_id: 'prod-1',
    variant_id: 'var-1' as string | null,
    quantity: 2,
    unit_price: new Prisma.Decimal(325),
    fulfilment: FulfilmentType.shipped,
    status: OrderItemStatus.pending,
    product: {
      id: 'prod-1',
      name: 'Konma Pickle',
      slug: 'konma-pickle',
      hsn_code: '2001',
      weight_grams: 250,
    },
    variant: { id: 'var-1', name: '500 g', sku: 'KP-500' },
    ...over,
  };
}

function orderRow(over: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    node_id: NODE_ID,
    order_number: 1042,
    status: OrderStatus.confirmed,
    customer_id: 'cust-1',
    customer_name: 'Demo Customer',
    customer_phone: '919900000001',
    delivery_address: '12 Villa Road',
    address_snapshot: null as Prisma.JsonValue | null,
    created_at: new Date('2026-08-24T05:00:00.000Z'),
    customer: {
      id: 'cust-1',
      name: 'Demo Customer',
      phone: '919900000001',
      email: 'demo.customer@konma.store',
    },
    items: [shippedItem()],
    ...over,
  };
}

async function build(
  opts: {
    provider?: ProviderDouble;
    settings?: Partial<typeof SETTING_DEFAULTS>;
  } = {},
) {
  const prisma = mockPrisma();
  const provider = opts.provider ?? shippingProvider();
  const settings = mockSettings(opts.settings ?? {});
  const resolver = {
    get: jest.fn().mockResolvedValue(provider),
    settings: jest.fn().mockResolvedValue(SETTING_DEFAULTS.shipping),
  };
  const audit = mockAuditService();
  const pusher = mockPusher();
  const emitter = mockEventEmitter();

  const moduleRef = await Test.createTestingModule({
    providers: [
      ShipmentsService,
      { provide: PrismaService, useValue: prisma },
      { provide: SettingsService, useValue: settings },
      { provide: ShippingProviderResolver, useValue: resolver },
      { provide: AuditService, useValue: audit },
      { provide: PusherService, useValue: pusher },
      { provide: EventEmitter2, useValue: emitter },
    ],
  }).compile();

  return {
    service: moduleRef.get(ShipmentsService),
    prisma: prisma,
    provider,
    audit,
    pusher,
    emitter,
  };
}

/**
 * Wires the mocks a `applyStatus` call needs: the row it reads, and the row the
 * update returns. Returns the updated row so assertions can name it.
 */
function stubTransition(
  prisma: MockPrisma,
  current: ReturnType<typeof shipmentRow>,
  next: Record<string, unknown>,
) {
  const updated = { ...current, ...next };
  prisma.shipment.findUnique.mockResolvedValue(current);
  prisma.shipment.update.mockResolvedValue(updated);
  prisma.shipmentEvent.upsert.mockResolvedValue({ id: 'ev-1' });
  prisma.order.findUnique.mockResolvedValue({ status: OrderStatus.confirmed });
  prisma.order.update.mockResolvedValue({});
  return updated;
}

describe('ShipmentsService', () => {
  afterEach(() => jest.clearAllMocks());

  // ─── pack ──────────────────────────────────────────────────────────────────

  describe('pack', () => {
    it('rejects an order with no shipped lines', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(
        orderRow({
          items: [shippedItem({ fulfilment: FulfilmentType.local })],
        }),
      );

      await expect(
        service.pack({ order_id: 'order-1' }, USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.shipment.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown order', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.pack({ order_id: 'order-404' }, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates one pending shipment, a ledger row, an audit event and the packed items', async () => {
      const { service, prisma, audit, pusher } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(orderRow());
      prisma.shipment.create.mockResolvedValue(shipmentRow());

      const result = await service.pack(
        {
          order_id: 'order-1',
          weight_grams: 550,
          pickup_location_code: 'KONMA-VILLA',
        },
        USER_ID,
      );

      expect(result.status).toBe(ShipmentStatus.pending);
      expect(
        callArg<{ data: Record<string, unknown> }>(prisma.shipment.create).data,
      ).toMatchObject({
        order_id: 'order-1',
        provider: ShippingProviderName.manual,
        status: ShipmentStatus.pending,
        pickup_location_code: 'KONMA-VILLA',
        weight_grams: 550,
        packed_by: USER_ID,
      });

      expect(
        callArg<{ data: Record<string, unknown> }>(prisma.shipmentEvent.create)
          .data,
      ).toMatchObject({
        shipment_id: 'ship-1',
        status: ShipmentStatus.pending,
        raw: { source: 'staff.pack' },
      });

      expect(prisma.orderItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-1'] } },
        data: { status: OrderItemStatus.packed },
      });

      const entry = callArg<AuditInput>(audit.record, 1);
      expect(entry.action).toBe('shipment.packed');
      expect(entry.entity_type).toBe('shipment');
      expect(entry.actor_type).toBe(ActorType.user);
      expect(pusher.trigger).toHaveBeenCalledWith(
        SHIPMENTS_CHANNEL,
        SHIPMENT_UPDATED_EVENT,
        expect.objectContaining({
          id: 'ship-1',
          status: ShipmentStatus.pending,
        }),
      );
    });

    it('decrements tracked variant stock and records it in the audit event, not a StockMovement', async () => {
      // `StockMovement.ingredient_id` is non-nullable and a ProductVariant is not
      // an Ingredient, so the plan's second branch applies.
      const { service, prisma, audit } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(orderRow());
      prisma.shipment.create.mockResolvedValue(shipmentRow());

      await service.pack({ order_id: 'order-1' }, USER_ID);

      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { stock_on_hand: { decrement: 2 } },
      });
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
      expect(callArg<AuditInput>(audit.record, 1).after).toMatchObject({
        stock_decrements: [{ variant_id: 'var-1', quantity: 2 }],
      });
    });

    it('leaves untracked lines alone', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(
        orderRow({ items: [shippedItem({ variant_id: null, variant: null })] }),
      );
      prisma.shipment.create.mockResolvedValue(shipmentRow());

      await service.pack({ order_id: 'order-1' }, USER_ID);

      expect(prisma.productVariant.update).not.toHaveBeenCalled();
    });

    it('falls back to the catalog weight, then to the configured default', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(orderRow());
      prisma.shipment.create.mockResolvedValue(shipmentRow());

      await service.pack({ order_id: 'order-1' }, USER_ID);
      // 250 g × 2 lines the catalog knows about.
      expect(
        callArg<{ data: { weight_grams: number } }>(prisma.shipment.create).data
          .weight_grams,
      ).toBe(500);

      jest.clearAllMocks();
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(
        orderRow({
          items: [
            shippedItem({
              product: { ...shippedItem().product, weight_grams: null },
            }),
          ],
        }),
      );
      prisma.shipment.create.mockResolvedValue(shipmentRow());

      await service.pack({ order_id: 'order-1' }, USER_ID);
      expect(
        callArg<{ data: { weight_grams: number } }>(prisma.shipment.create).data
          .weight_grams,
      ).toBe(SETTING_DEFAULTS.shipping.default_weight_grams);
    });

    it('returns the existing shipment on a second pack, without a second ledger row', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(shipmentRow());

      const result = await service.pack({ order_id: 'order-1' }, USER_ID);

      expect(result.id).toBe('ship-1');
      expect(prisma.shipment.create).not.toHaveBeenCalled();
      expect(prisma.shipmentEvent.create).not.toHaveBeenCalled();
    });

    it('returns the winner of a concurrent pack when order_id collides (P2002)', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(orderRow());
      prisma.shipment.create.mockRejectedValue({ code: 'P2002' });
      prisma.shipment.findUniqueOrThrow.mockResolvedValue(
        shipmentRow({ id: 'ship-winner' }),
      );

      const result = await service.pack({ order_id: 'order-1' }, USER_ID);

      expect(result.id).toBe('ship-winner');
      expect(prisma.shipment.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { order_id: 'order-1' },
      });
    });

    it('registers the parcel with a real courier and stores the provider ids', async () => {
      const provider = shippingProvider(ShippingProviderName.shiprocket);
      provider.createShipment.mockResolvedValue({
        provider_order_id: 'so-1',
        provider_shipment_id: 'ss-1',
      });
      const { service, prisma } = await build({
        provider,
        settings: {
          shipping: {
            ...SETTING_DEFAULTS.shipping,
            provider: 'shiprocket',
            pickup_location_code: 'KONMA-VILLA',
          },
        },
      });
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(orderRow());
      prisma.shipment.create.mockResolvedValue(shipmentRow());

      await service.pack({ order_id: 'order-1' }, USER_ID);

      const draft = callArg<ShipmentDraft>(provider.createShipment);
      expect(draft.order_number).toBe(1042);
      expect(draft.pickup_location_code).toBe('KONMA-VILLA');
      // ₹325 in paise × 2 — money crosses the port as integer paise.
      expect(draft.lines).toEqual([
        {
          name: 'Konma Pickle (500 g)',
          sku: 'KP-500',
          quantity: 2,
          unit_price: 32_500,
          hsn_code: '2001',
        },
      ]);
      expect(draft.sub_total_paise).toBe(65_000);
      expect(draft.billing.phone).toBe('919900000001');

      expect(
        callArg<{ data: Record<string, unknown> }>(prisma.shipment.create).data,
      ).toMatchObject({
        provider_order_id: 'so-1',
        provider_shipment_id: 'ss-1',
      });
    });

    it('still records the pack when the courier is unreachable', async () => {
      const provider = shippingProvider(ShippingProviderName.shiprocket);
      provider.createShipment.mockRejectedValue(new Error('Shiprocket down'));
      const { service, prisma } = await build({
        provider,
        settings: {
          shipping: { ...SETTING_DEFAULTS.shipping, provider: 'shiprocket' },
        },
      });
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(orderRow());
      prisma.shipment.create.mockResolvedValue(shipmentRow());

      await expect(
        service.pack({ order_id: 'order-1' }, USER_ID),
      ).resolves.toMatchObject({ id: 'ship-1' });
      expect(
        callArg<{ data: Record<string, unknown> }>(prisma.shipment.create).data,
      ).toMatchObject({ provider_order_id: null });
    });

    it('does not call the courier at all with the manual provider', async () => {
      const { service, prisma, provider } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(orderRow());
      prisma.shipment.create.mockResolvedValue(shipmentRow());

      await service.pack({ order_id: 'order-1' }, USER_ID);

      expect(provider.createShipment).not.toHaveBeenCalled();
    });
  });

  // ─── AWB ───────────────────────────────────────────────────────────────────

  describe('assignAwb', () => {
    it('stores the pasted AWB and tracking URL with the manual provider', async () => {
      const { service, prisma, provider, emitter } = await build();
      const current = shipmentRow();
      prisma.shipment.findUnique.mockResolvedValue({
        ...current,
        order: orderRow(),
      });
      prisma.shipment.update.mockResolvedValue({
        ...current,
        status: ShipmentStatus.awb_assigned,
        awb: 'MANUAL-0042',
        courier_name: 'Local courier',
        tracking_url: 'https://track.example.test/MANUAL-0042',
      });
      prisma.shipmentEvent.upsert.mockResolvedValue({ id: 'ev-1' });

      const dto: ManualAwbDto = {
        awb: 'MANUAL-0042',
        courier_name: 'Local courier',
        tracking_url: 'https://track.example.test/MANUAL-0042',
      };
      const result = await service.assignAwb('ship-1', dto, USER_ID);

      expect(provider.assignAwb).toHaveBeenCalledWith({
        provider_order_id: null,
        provider_shipment_id: null,
        awb: null,
      });
      expect(
        callArg<{ data: Record<string, unknown> }>(prisma.shipment.update).data,
      ).toMatchObject({
        status: ShipmentStatus.awb_assigned,
        awb: 'MANUAL-0042',
        courier_name: 'Local courier',
        tracking_url: 'https://track.example.test/MANUAL-0042',
      });
      expect(result.status).toBe(ShipmentStatus.awb_assigned);
      expect(emitter.emit).toHaveBeenCalledWith(
        DomainEvent.SHIPMENT_STATUS_CHANGED,
        expect.objectContaining({
          shipmentId: 'ship-1',
          orderId: 'order-1',
          status: ShipmentStatus.awb_assigned,
          awb: 'MANUAL-0042',
          node_id: NODE_ID,
        }),
      );
    });

    it('rejects a manual assignment with nothing to store', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue({
        ...shipmentRow(),
        order: orderRow(),
      });

      await expect(
        service.assignAwb('ship-1', {}, USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });

    it('creates the shipment then assigns the AWB with the Shiprocket provider', async () => {
      const provider = shippingProvider(ShippingProviderName.shiprocket);
      provider.createShipment.mockResolvedValue({
        provider_order_id: 'so-1',
        provider_shipment_id: 'ss-1',
      });
      provider.assignAwb.mockResolvedValue({
        awb: '1234567890',
        courier_name: 'Delhivery',
        courier_id: '17',
      });
      const { service, prisma } = await build({
        provider,
        settings: {
          shipping: { ...SETTING_DEFAULTS.shipping, provider: 'shiprocket' },
        },
      });
      const current = shipmentRow({
        provider: ShippingProviderName.shiprocket,
      });
      prisma.shipment.findUnique.mockResolvedValue({
        ...current,
        order: orderRow(),
      });
      prisma.shipment.update.mockResolvedValue({
        ...current,
        status: ShipmentStatus.awb_assigned,
        awb: '1234567890',
      });
      prisma.shipmentEvent.upsert.mockResolvedValue({ id: 'ev-1' });

      // The pasted body loses to the provider's answer.
      await service.assignAwb('ship-1', { awb: 'IGNORED' }, USER_ID);

      expect(provider.createShipment).toHaveBeenCalledTimes(1);
      expect(provider.assignAwb).toHaveBeenCalledWith({
        provider_order_id: 'so-1',
        provider_shipment_id: 'ss-1',
        awb: null,
      });
      expect(
        callArg<{ data: Record<string, unknown> }>(prisma.shipment.update).data,
      ).toMatchObject({
        provider_order_id: 'so-1',
        provider_shipment_id: 'ss-1',
        awb: '1234567890',
        courier_name: 'Delhivery',
        status: ShipmentStatus.awb_assigned,
      });
    });

    it('skips re-registering a parcel the courier already knows', async () => {
      const provider = shippingProvider(ShippingProviderName.shiprocket);
      provider.assignAwb.mockResolvedValue({
        awb: '1234567890',
        courier_name: 'Delhivery',
        courier_id: '17',
      });
      const { service, prisma } = await build({
        provider,
        settings: {
          shipping: { ...SETTING_DEFAULTS.shipping, provider: 'shiprocket' },
        },
      });
      const current = shipmentRow({ provider_order_id: 'so-1' });
      prisma.shipment.findUnique.mockResolvedValue({
        ...current,
        order: orderRow(),
      });
      prisma.shipment.update.mockResolvedValue({
        ...current,
        status: ShipmentStatus.awb_assigned,
        awb: '1234567890',
      });
      prisma.shipmentEvent.upsert.mockResolvedValue({ id: 'ev-1' });

      await service.assignAwb('ship-1', {}, USER_ID);

      expect(provider.createShipment).not.toHaveBeenCalled();
    });

    it('rejects an AWB on a cancelled shipment', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue({
        ...shipmentRow({ status: ShipmentStatus.cancelled }),
        order: orderRow(),
      });

      await expect(
        service.assignAwb('ship-1', { awb: 'X' }, USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── pickup ────────────────────────────────────────────────────────────────

  describe('schedulePickup', () => {
    it('requires an assigned AWB', async () => {
      const { service, prisma, provider } = await build();
      prisma.shipment.findUnique.mockResolvedValue(shipmentRow());

      await expect(
        service.schedulePickup('ship-1', USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(provider.schedulePickup).not.toHaveBeenCalled();
    });

    it('moves an awb_assigned shipment to pickup_scheduled', async () => {
      const { service, prisma, provider, pusher } = await build();
      const scheduledFor = new Date('2026-08-25T04:30:00.000Z');
      provider.schedulePickup.mockResolvedValue({
        scheduled: true,
        pickup_token: 'pk-9',
        pickup_scheduled_date: scheduledFor,
      });
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.awb_assigned, awb: 'AWB-1' }),
        { status: ShipmentStatus.pickup_scheduled },
      );

      const result = await service.schedulePickup('ship-1', USER_ID);

      expect(provider.schedulePickup).toHaveBeenCalledWith({
        provider_order_id: null,
        provider_shipment_id: null,
        awb: 'AWB-1',
      });
      expect(
        callArg<{ data: Record<string, unknown> }>(prisma.shipment.update).data,
      ).toMatchObject({
        status: ShipmentStatus.pickup_scheduled,
        etd: scheduledFor,
      });
      expect(result.status).toBe(ShipmentStatus.pickup_scheduled);
      expect(pusher.trigger).toHaveBeenCalledWith(
        SHIPMENTS_CHANNEL,
        SHIPMENT_UPDATED_EVENT,
        expect.objectContaining({ status: ShipmentStatus.pickup_scheduled }),
      );
    });

    it('surfaces a courier that refuses the pickup', async () => {
      const { service, prisma, provider } = await build();
      provider.schedulePickup.mockResolvedValue({
        scheduled: false,
        pickup_token: null,
        pickup_scheduled_date: null,
      });
      prisma.shipment.findUnique.mockResolvedValue(
        shipmentRow({ status: ShipmentStatus.awb_assigned, awb: 'AWB-1' }),
      );

      await expect(
        service.schedulePickup('ship-1', USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });
  });

  // ─── label ─────────────────────────────────────────────────────────────────

  describe('getLabel', () => {
    it('requires an AWB', async () => {
      const { service, prisma, provider } = await build();
      prisma.shipment.findUnique.mockResolvedValue(shipmentRow());

      await expect(service.getLabel('ship-1', USER_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(provider.getLabel).not.toHaveBeenCalled();
    });

    it('fetches the label once and caches it on the row', async () => {
      const { service, prisma, provider, audit } = await build();
      provider.getLabel.mockResolvedValue({
        label_url: 'https://labels.example.test/1.pdf',
      });
      prisma.shipment.findUnique.mockResolvedValue(
        shipmentRow({ status: ShipmentStatus.awb_assigned, awb: 'AWB-1' }),
      );
      prisma.shipment.update.mockResolvedValue({});

      const result = await service.getLabel('ship-1', USER_ID);

      expect(result).toEqual({
        label_url: 'https://labels.example.test/1.pdf',
      });
      expect(prisma.shipment.update).toHaveBeenCalledWith({
        where: { id: 'ship-1' },
        data: { label_url: 'https://labels.example.test/1.pdf' },
      });
      expect(callArg<AuditInput>(audit.record, 1).action).toBe(
        'shipment.label_generated',
      );
    });

    it('serves the cached label without calling the courier again', async () => {
      const { service, prisma, provider } = await build();
      prisma.shipment.findUnique.mockResolvedValue(
        shipmentRow({
          status: ShipmentStatus.awb_assigned,
          awb: 'AWB-1',
          label_url: 'https://labels.example.test/1.pdf',
        }),
      );

      await expect(service.getLabel('ship-1', USER_ID)).resolves.toEqual({
        label_url: 'https://labels.example.test/1.pdf',
      });
      expect(provider.getLabel).not.toHaveBeenCalled();
      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });

    it('returns null when the provider issues no label', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(
        shipmentRow({ status: ShipmentStatus.awb_assigned, awb: 'AWB-1' }),
      );

      await expect(service.getLabel('ship-1', USER_ID)).resolves.toEqual({
        label_url: null,
      });
      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });
  });

  // ─── cancel ────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('refuses to cancel a delivered shipment', async () => {
      const { service, prisma, provider } = await build();
      prisma.shipment.findUnique.mockResolvedValue(
        shipmentRow({ status: ShipmentStatus.delivered, awb: 'AWB-1' }),
      );

      await expect(
        service.cancel('ship-1', 'Customer cancelled', USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(provider.cancel).not.toHaveBeenCalled();
    });

    it('cancels a scheduled pickup through the provider', async () => {
      const { service, prisma, provider, pusher, emitter } = await build();
      stubTransition(
        prisma,
        shipmentRow({
          status: ShipmentStatus.pickup_scheduled,
          awb: 'AWB-1',
        }),
        { status: ShipmentStatus.cancelled },
      );

      const result = await service.cancel(
        'ship-1',
        'Customer cancelled',
        USER_ID,
      );

      expect(provider.cancel).toHaveBeenCalledWith({
        provider_order_id: null,
        provider_shipment_id: null,
        awb: 'AWB-1',
      });
      expect(result.status).toBe(ShipmentStatus.cancelled);
      expect(
        callArg<{ create: { raw: Record<string, unknown> } }>(
          prisma.shipmentEvent.upsert,
        ).create.raw,
      ).toMatchObject({
        source: 'staff.cancel',
        reason: 'Customer cancelled',
      });
      expect(pusher.trigger).toHaveBeenCalledWith(
        SHIPMENTS_CHANNEL,
        SHIPMENT_UPDATED_EVENT,
        expect.objectContaining({ status: ShipmentStatus.cancelled }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        DomainEvent.SHIPMENT_STATUS_CHANGED,
        expect.objectContaining({ status: ShipmentStatus.cancelled }),
      );
    });

    it('surfaces a courier that refuses the cancellation', async () => {
      const { service, prisma, provider } = await build();
      provider.cancel.mockResolvedValue({
        cancelled: false,
        reason: 'Already in transit',
      });
      prisma.shipment.findUnique.mockResolvedValue(
        shipmentRow({ status: ShipmentStatus.pickup_scheduled, awb: 'AWB-1' }),
      );

      await expect(
        service.cancel('ship-1', undefined, USER_ID),
      ).rejects.toThrow('Already in transit');
    });
  });

  // ─── applyStatus: the single write path ────────────────────────────────────

  describe('applyStatus', () => {
    const systemActor = {
      actor_type: ActorType.system,
      actor_id: null,
    };

    it('appends the ledger row idempotently on (shipment, status, occurred_at)', async () => {
      const { service, prisma } = await build();
      const occurredAt = new Date('2026-08-26T08:12:00.000Z');
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.out_for_delivery, awb: 'AWB-1' }),
        { status: ShipmentStatus.delivered },
      );

      await service.applyStatus(
        'ship-1',
        ShipmentStatus.delivered,
        occurredAt,
        { scans: [] },
        systemActor,
      );

      expect(prisma.shipmentEvent.upsert).toHaveBeenCalledWith({
        where: {
          shipment_id_status_occurred_at: {
            shipment_id: 'ship-1',
            status: ShipmentStatus.delivered,
            occurred_at: occurredAt,
          },
        },
        create: {
          shipment_id: 'ship-1',
          status: ShipmentStatus.delivered,
          occurred_at: occurredAt,
          raw: { scans: [] },
        },
        update: {},
      });
    });

    it('writes an audit event carrying the actor and both statuses', async () => {
      const { service, prisma, audit } = await build();
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.picked_up, awb: 'AWB-1' }),
        { status: ShipmentStatus.in_transit },
      );

      await service.applyStatus(
        'ship-1',
        ShipmentStatus.in_transit,
        new Date(),
        null,
        systemActor,
      );

      const entry = callArg<AuditInput>(audit.record, 1);
      expect(entry).toMatchObject({
        entity_type: 'shipment',
        entity_id: 'ship-1',
        action: 'shipment.status_changed',
        node_id: NODE_ID,
        actor_type: ActorType.system,
        actor_id: null,
      });
      expect(entry.before).toMatchObject({ status: ShipmentStatus.picked_up });
      expect(entry.after).toMatchObject({ status: ShipmentStatus.in_transit });
    });

    it('promotes the order to shipped once the parcel is moving', async () => {
      const { service, prisma } = await build();
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.pickup_scheduled, awb: 'AWB-1' }),
        { status: ShipmentStatus.picked_up },
      );

      await service.applyStatus(
        'ship-1',
        ShipmentStatus.picked_up,
        new Date(),
        null,
        systemActor,
      );

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.shipped },
      });
    });

    it('never drags a delivered order backwards', async () => {
      const { service, prisma } = await build();
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.pickup_scheduled, awb: 'AWB-1' }),
        { status: ShipmentStatus.picked_up },
      );
      prisma.order.findUnique.mockResolvedValue({
        status: OrderStatus.delivered,
      });

      await service.applyStatus(
        'ship-1',
        ShipmentStatus.picked_up,
        new Date(),
        null,
        systemActor,
      );

      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('leaves the order alone on a non-transit transition', async () => {
      const { service, prisma } = await build();
      stubTransition(prisma, shipmentRow(), {
        status: ShipmentStatus.awb_assigned,
      });

      await service.applyStatus(
        'ship-1',
        ShipmentStatus.awb_assigned,
        new Date(),
        null,
        systemActor,
      );

      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('accepts a replay of the current status without re-emitting', async () => {
      const { service, prisma, emitter } = await build();
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.in_transit, awb: 'AWB-1' }),
        { status: ShipmentStatus.in_transit },
      );

      await service.applyStatus(
        'ship-1',
        ShipmentStatus.in_transit,
        new Date(),
        null,
        systemActor,
      );

      expect(prisma.shipmentEvent.upsert).toHaveBeenCalledTimes(1);
      expect(emitter.emit).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('accepts a forward skip the courier reports out of order', async () => {
      const { service, prisma } = await build();
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.awb_assigned, awb: 'AWB-1' }),
        { status: ShipmentStatus.in_transit },
      );

      await expect(
        service.applyStatus(
          'ship-1',
          ShipmentStatus.in_transit,
          new Date(),
          null,
          systemActor,
        ),
      ).resolves.toMatchObject({ status: ShipmentStatus.in_transit });
    });

    it('rejects a backward move', async () => {
      const { service, prisma } = await build();
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.in_transit, awb: 'AWB-1' }),
        { status: ShipmentStatus.awb_assigned },
      );

      await expect(
        service.applyStatus(
          'ship-1',
          ShipmentStatus.awb_assigned,
          new Date(),
          null,
          systemActor,
        ),
      ).rejects.toThrow(
        'Cannot move a shipment from in_transit to awb_assigned',
      );
    });

    it('rejects a transition out of a terminal state', async () => {
      const { service, prisma } = await build();
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.rto, awb: 'AWB-1' }),
        { status: ShipmentStatus.delivered },
      );

      await expect(
        service.applyStatus(
          'ship-1',
          ShipmentStatus.delivered,
          new Date(),
          null,
          systemActor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('survives a Pusher outage', async () => {
      const { service, prisma, pusher } = await build();
      pusher.trigger.mockRejectedValue(new Error('Pusher down'));
      stubTransition(
        prisma,
        shipmentRow({ status: ShipmentStatus.picked_up, awb: 'AWB-1' }),
        { status: ShipmentStatus.in_transit },
      );

      await expect(
        service.applyStatus(
          'ship-1',
          ShipmentStatus.in_transit,
          new Date(),
          null,
          systemActor,
        ),
      ).resolves.toMatchObject({ status: ShipmentStatus.in_transit });
    });

    it('rejects an unknown shipment', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);

      await expect(
        service.applyStatus(
          'ship-404',
          ShipmentStatus.delivered,
          new Date(),
          null,
          systemActor,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── reads ─────────────────────────────────────────────────────────────────

  describe('reads', () => {
    it('paginates the queue by cursor and reports the next one', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findMany.mockResolvedValue([
        shipmentRow({ id: 'a' }),
        shipmentRow({ id: 'b' }),
        shipmentRow({ id: 'c' }),
      ]);

      const page = await service.list(ShipmentStatus.pending, undefined, 2);

      expect(page.items).toHaveLength(2);
      expect(page.next_cursor).toBe('b');
      const args = callArg<{ where: unknown; take: number }>(
        prisma.shipment.findMany,
      );
      expect(args.where).toEqual({ status: ShipmentStatus.pending });
      expect(args.take).toBe(3);
    });

    it('reports no next cursor on the last page', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findMany.mockResolvedValue([shipmentRow()]);

      await expect(service.list()).resolves.toMatchObject({
        next_cursor: null,
      });
    });

    it('returns the tracking ledger newest first', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue({
        ...shipmentRow(),
        events: [],
      });

      await service.findOne('ship-1');

      const args = callArg<{ include: { events: { orderBy: unknown } } }>(
        prisma.shipment.findUnique,
      );
      expect(args.include.events.orderBy).toEqual({ occurred_at: 'desc' });
    });

    it('404s an unknown shipment', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ship-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns null for an order with no shipped lines', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(null);

      await expect(service.findForOrder('order-9')).resolves.toBeNull();
      expect(prisma.shipment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { order_id: 'order-9' } }),
      );
    });

    it('looks a parcel up by AWB for the courier webhook', async () => {
      const { service, prisma } = await build();
      prisma.shipment.findUnique.mockResolvedValue(shipmentRow());

      await service.findByAwb('1234567890');

      expect(prisma.shipment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { awb: '1234567890' } }),
      );
    });
  });

  // ─── DTOs ──────────────────────────────────────────────────────────────────

  describe('dto validation', () => {
    it('requires a UUID order_id to pack', async () => {
      const dto = plainToInstance(PackShipmentDto, { order_id: 'not-a-uuid' });
      const errors = await validate(dto);
      expect(errors.map((e) => e.property)).toContain('order_id');
    });

    it('accepts the documented pack body', async () => {
      const dto = plainToInstance(PackShipmentDto, {
        order_id: '11111111-1111-4111-8111-111111111111',
        weight_grams: 550,
        pickup_location_code: 'KONMA-VILLA',
      });
      await expect(validate(dto)).resolves.toEqual([]);
    });

    it('rejects a non-URL tracking link', async () => {
      const dto = plainToInstance(ManualAwbDto, { tracking_url: 'nope' });
      const errors = await validate(dto);
      expect(errors.map((e) => e.property)).toContain('tracking_url');
    });

    it('accepts an entirely empty AWB body — the provider may issue everything', async () => {
      const dto = plainToInstance(ManualAwbDto, {});
      await expect(validate(dto)).resolves.toEqual([]);
    });
  });
});
