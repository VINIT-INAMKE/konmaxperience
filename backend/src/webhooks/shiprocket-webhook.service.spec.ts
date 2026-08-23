import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActorType,
  FulfilmentType,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../chat/pusher.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { WhatsAppService } from '../customer-auth/whatsapp.service';
import { DomainEvent } from '../common/events/domain-events';
import {
  CUSTOMER_SHIPMENT_EVENT,
  SHIPMENT_WHATSAPP_TEMPLATE,
  ShiprocketWebhookService,
  parseShiprocketTimestamp,
  type ShiprocketWebhookBody,
} from './shiprocket-webhook.service';
import {
  mockEventEmitter,
  mockPrisma,
  mockPusher,
  mockWhatsApp,
  type MockPrisma,
} from '../test-utils/mock-providers';

const TOKEN = 'shiprocket-shared-secret-0001';
const NODE_ID = '11111111-1111-4111-8111-111111111111';
const SHIPMENT_ID = 'shp-1';
const ORDER_ID = 'ord-1';
const CUSTOMER_ID = 'cus-1';
const AWB = '1234567890';

function shipmentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: SHIPMENT_ID,
    node_id: NODE_ID,
    order_id: ORDER_ID,
    awb: AWB,
    courier_name: 'Delhivery Surface',
    tracking_url: 'https://track.test/1234567890',
    status: ShipmentStatus.in_transit,
    order: {
      id: ORDER_ID,
      order_number: 1042,
      status: OrderStatus.shipped,
      customer_id: CUSTOMER_ID,
      customer_name: 'Asha',
      customer_phone: '9876543210',
      delivery_address: '12 Palm Road',
      created_at: new Date('2026-08-20T06:00:00.000Z'),
    },
    ...overrides,
  };
}

function bodyFixture(
  overrides: Partial<ShiprocketWebhookBody> = {},
): ShiprocketWebhookBody {
  return {
    awb: AWB,
    current_status: 'OUT FOR DELIVERY',
    current_timestamp: '2026-08-23 14:30:00',
    courier_name: 'Delhivery Surface',
    order_id: '9911',
    ...overrides,
  };
}

describe('ShiprocketWebhookService', () => {
  let service: ShiprocketWebhookService;
  let prisma: MockPrisma;
  let shipments: { findByAwb: jest.Mock; applyStatus: jest.Mock };
  let pusher: ReturnType<typeof mockPusher>;
  let whatsapp: ReturnType<typeof mockWhatsApp>;
  let emitter: ReturnType<typeof mockEventEmitter>;
  let config: { get: jest.Mock };

  /** Lets the fire-and-forget notification promises settle before assertions. */
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.orderItem.updateMany.mockResolvedValue({ count: 2 });
    prisma.orderItem.count.mockResolvedValue(0);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findUnique.mockResolvedValue({
      order_number: 1042,
      channel: 'delivery',
      total: new Prisma.Decimal('1499.00'),
    });

    shipments = {
      findByAwb: jest.fn().mockResolvedValue(shipmentFixture()),
      applyStatus: jest
        .fn()
        .mockImplementation((_id: string, next: ShipmentStatus) =>
          Promise.resolve(shipmentFixture({ status: next })),
        ),
    };
    pusher = mockPusher();
    whatsapp = mockWhatsApp();
    emitter = mockEventEmitter();
    config = { get: jest.fn().mockReturnValue(TOKEN) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiprocketWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: ShipmentsService, useValue: shipments },
        { provide: PusherService, useValue: pusher },
        { provide: WhatsAppService, useValue: whatsapp },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get(ShiprocketWebhookService);
  });

  const emitted = (name: string): unknown[][] =>
    (emitter.emit.mock.calls as unknown[][]).filter((call) => call[0] === name);

  /** The positional arguments of the nth `applyStatus` call. */
  const applyStatusCall = (n = 0) =>
    (shipments.applyStatus.mock.calls as unknown[][])[n] as [
      string,
      ShipmentStatus,
      Date,
      unknown,
      unknown,
    ];

  // ─── authentication ───────────────────────────────────────────────────────

  describe('assertAuthorised', () => {
    it('rejects a missing token before touching the database', async () => {
      await expect(service.handle(undefined, bodyFixture())).rejects.toThrow(
        UnauthorizedException,
      );
      expect(shipments.findByAwb).not.toHaveBeenCalled();
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a wrong token of the same length', async () => {
      const wrong = 'X'.repeat(TOKEN.length);
      expect(wrong).toHaveLength(TOKEN.length);
      await expect(service.handle(wrong, bodyFixture())).rejects.toThrow(
        UnauthorizedException,
      );
      expect(shipments.findByAwb).not.toHaveBeenCalled();
    });

    it('rejects a token of a different length without letting timingSafeEqual throw', async () => {
      // timingSafeEqual throws a RangeError on unequal buffer lengths, so the
      // length check must come first or a short token would 500 instead of 401.
      await expect(service.handle('short', bodyFixture())).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(
        service.handle(`${TOKEN}-and-then-some`, bodyFixture()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuses the route entirely when SHIPROCKET_WEBHOOK_TOKEN is unset', async () => {
      config.get.mockReturnValue(undefined);
      await expect(service.handle(TOKEN, bodyFixture())).rejects.toThrow(
        ForbiddenException,
      );
      expect(shipments.findByAwb).not.toHaveBeenCalled();
    });

    it('accepts the configured token', () => {
      expect(() => service.assertAuthorised(TOKEN)).not.toThrow();
    });
  });

  // ─── payloads we ignore (always 200 — Shiprocket retries any non-2xx) ─────

  describe('ignored payloads', () => {
    it('ignores a body with no AWB without a lookup', async () => {
      const result = await service.handle(
        TOKEN,
        bodyFixture({ awb: undefined }),
      );
      expect(result).toEqual({ status: 'ignored', reason: 'no awb' });
      expect(shipments.findByAwb).not.toHaveBeenCalled();
    });

    it('ignores a blank AWB', async () => {
      const result = await service.handle(TOKEN, bodyFixture({ awb: '   ' }));
      expect(result).toEqual({ status: 'ignored', reason: 'no awb' });
    });

    it('ignores an unknown AWB rather than throwing', async () => {
      shipments.findByAwb.mockResolvedValue(null);
      const result = await service.handle(TOKEN, bodyFixture());
      expect(result).toEqual({ status: 'ignored', reason: 'unknown awb' });
      expect(shipments.applyStatus).not.toHaveBeenCalled();
    });

    it('ignores a scan that would move the parcel backwards', async () => {
      shipments.applyStatus.mockRejectedValue(
        new BadRequestException(
          'Cannot move a shipment from delivered to failed',
        ),
      );
      const result = await service.handle(
        TOKEN,
        bodyFixture({ current_status: 'LOST' }),
      );
      expect(result).toEqual({
        status: 'ignored',
        reason: 'invalid transition',
      });
      expect(prisma.orderItem.updateMany).not.toHaveBeenCalled();
    });

    it('still propagates a non-transition failure', async () => {
      shipments.applyStatus.mockRejectedValue(new Error('database is down'));
      await expect(service.handle(TOKEN, bodyFixture())).rejects.toThrow(
        'database is down',
      );
    });
  });

  // ─── status mapping and the single write path ─────────────────────────────

  describe('applyStatus delegation', () => {
    it('maps the provider string and writes through ShipmentsService once', async () => {
      const body = bodyFixture();
      const result = await service.handle(TOKEN, body);

      expect(shipments.findByAwb).toHaveBeenCalledWith(AWB);
      expect(shipments.applyStatus).toHaveBeenCalledTimes(1);
      const [id, next, occurredAt, raw, actor] = applyStatusCall();
      expect(id).toBe(SHIPMENT_ID);
      expect(next).toBe(ShipmentStatus.out_for_delivery);
      expect(occurredAt).toEqual(new Date('2026-08-23T14:30:00'));
      expect(raw).toBe(body);
      expect(actor).toEqual({ actor_type: ActorType.system, actor_id: null });
      expect(result).toEqual({
        status: 'ok',
        shipment_status: ShipmentStatus.out_for_delivery,
        order_delivered: false,
      });
    });

    it('accepts a numeric AWB', async () => {
      await service.handle(TOKEN, bodyFixture({ awb: 1234567890 }));
      expect(shipments.findByAwb).toHaveBeenCalledWith(AWB);
    });

    it('maps an unrecognised provider string to failed and still records it', async () => {
      shipments.findByAwb.mockResolvedValue(
        shipmentFixture({ status: ShipmentStatus.picked_up }),
      );
      const result = await service.handle(
        TOKEN,
        bodyFixture({ current_status: 'DELIVERY ATTEMPT REFUSED' }),
      );
      expect(shipments.applyStatus).toHaveBeenCalledWith(
        SHIPMENT_ID,
        ShipmentStatus.failed,
        expect.any(Date),
        expect.any(Object),
        expect.objectContaining({ actor_type: ActorType.system }),
      );
      expect(result).toMatchObject({
        status: 'ok',
        shipment_status: ShipmentStatus.failed,
      });
    });

    it('falls back to now when the timestamp is missing or unparseable', async () => {
      const before = Date.now();
      await service.handle(
        TOKEN,
        bodyFixture({ current_timestamp: 'not a date' }),
      );
      const [, , occurredAt] = applyStatusCall();
      expect(occurredAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(
        parseShiprocketTimestamp(undefined).getTime(),
      ).toBeGreaterThanOrEqual(before);
    });

    it('does not re-emit shipment.status_changed or promote the order itself', async () => {
      // Both are `ShipmentsService.applyStatus`'s job (P5a Task 11); repeating
      // them here would double-fire the bridge and race the transition guard.
      await service.handle(TOKEN, bodyFixture({ current_status: 'SHIPPED' }));
      expect(emitted(DomainEvent.SHIPMENT_STATUS_CHANGED)).toHaveLength(0);
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  // ─── the delivered fan-out ────────────────────────────────────────────────

  describe('delivered fan-out', () => {
    const deliveredBody = () => bodyFixture({ current_status: 'DELIVERED' });

    beforeEach(() => {
      shipments.findByAwb.mockResolvedValue(
        shipmentFixture({ status: ShipmentStatus.out_for_delivery }),
      );
    });

    it('marks every shipped line delivered and closes the order', async () => {
      const result = await service.handle(TOKEN, deliveredBody());

      expect(prisma.orderItem.updateMany).toHaveBeenCalledWith({
        where: { order_id: ORDER_ID, fulfilment: FulfilmentType.shipped },
        data: { status: OrderItemStatus.delivered },
      });
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: ORDER_ID,
          status: {
            notIn: [
              OrderStatus.delivered,
              OrderStatus.completed,
              OrderStatus.cancelled,
              OrderStatus.refunded,
            ],
          },
        },
        data: { status: OrderStatus.delivered },
      });
      expect(result).toEqual({
        status: 'ok',
        shipment_status: ShipmentStatus.delivered,
        order_delivered: true,
      });
    });

    it('counts only unsettled lines when deciding the order is finished', async () => {
      await service.handle(TOKEN, deliveredBody());
      expect(prisma.orderItem.count).toHaveBeenCalledWith({
        where: {
          order_id: ORDER_ID,
          status: {
            notIn: [
              OrderItemStatus.delivered,
              OrderItemStatus.attended,
              OrderItemStatus.cancelled,
              OrderItemStatus.ready,
            ],
          },
        },
      });
    });

    it('emits shipment.delivered and order.delivered with the SPEC envelope', async () => {
      await service.handle(TOKEN, deliveredBody());

      const [shipmentEvent] = emitted(DomainEvent.SHIPMENT_DELIVERED);
      expect(shipmentEvent[1]).toMatchObject({
        node_id: NODE_ID,
        actor: { actor_type: ActorType.system, actor_id: null },
        shipmentId: SHIPMENT_ID,
        orderId: ORDER_ID,
        awb: AWB,
      });
      expect(shipmentEvent[1]).toHaveProperty('occurred_at');

      const [orderEvent] = emitted(DomainEvent.ORDER_DELIVERED);
      expect(orderEvent[1]).toMatchObject({
        node_id: NODE_ID,
        orderId: ORDER_ID,
        orderNumber: 1042,
        channel: 'delivery',
        total: '1499',
      });
    });

    it('leaves a mixed order open while local lines are still outstanding', async () => {
      prisma.orderItem.count.mockResolvedValue(1);
      const result = await service.handle(TOKEN, deliveredBody());

      expect(prisma.orderItem.updateMany).toHaveBeenCalled();
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(emitted(DomainEvent.SHIPMENT_DELIVERED)).toHaveLength(1);
      expect(emitted(DomainEvent.ORDER_DELIVERED)).toHaveLength(0);
      expect(result).toMatchObject({ order_delivered: false });
    });

    it('never drags a cancelled or refunded order into delivered', async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      const result = await service.handle(TOKEN, deliveredBody());

      expect(emitted(DomainEvent.SHIPMENT_DELIVERED)).toHaveLength(1);
      expect(emitted(DomainEvent.ORDER_DELIVERED)).toHaveLength(0);
      expect(result).toMatchObject({ order_delivered: false });
    });

    it('notifies the customer on Pusher and WhatsApp', async () => {
      await service.handle(TOKEN, deliveredBody());
      await flush();

      expect(pusher.trigger).toHaveBeenCalledWith(
        `private-customer-${CUSTOMER_ID}`,
        CUSTOMER_SHIPMENT_EVENT,
        expect.objectContaining({ status: ShipmentStatus.delivered }),
      );
      expect(whatsapp.sendTemplate).toHaveBeenCalledWith(
        '9876543210',
        SHIPMENT_WHATSAPP_TEMPLATE,
        [ShipmentStatus.delivered, AWB, 'Delhivery Surface'],
      );
    });

    it('is a no-op on replay — the second delivery changes nothing', async () => {
      await service.handle(TOKEN, deliveredBody());
      jest.clearAllMocks();

      // Shiprocket redelivers: the shipment already reads `delivered`.
      shipments.findByAwb.mockResolvedValue(
        shipmentFixture({ status: ShipmentStatus.delivered }),
      );
      shipments.applyStatus.mockResolvedValue(
        shipmentFixture({ status: ShipmentStatus.delivered }),
      );
      const result = await service.handle(TOKEN, deliveredBody());
      await flush();

      // `applyStatus` is still called — it upserts the same ledger row on
      // @@unique([shipment_id, status, occurred_at]) and short-circuits the
      // from === to transition — but nothing downstream of it fires twice.
      expect(shipments.applyStatus).toHaveBeenCalledTimes(1);
      expect(prisma.orderItem.updateMany).not.toHaveBeenCalled();
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(emitter.emit).not.toHaveBeenCalled();
      expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: 'ok',
        shipment_status: ShipmentStatus.delivered,
        order_delivered: false,
      });
    });
  });

  // ─── SHIP-05 customer notification ────────────────────────────────────────

  describe('customer notification', () => {
    it('broadcasts on the customer channel for every scan', async () => {
      await service.handle(TOKEN, bodyFixture());
      await flush();

      expect(pusher.trigger).toHaveBeenCalledWith(
        `private-customer-${CUSTOMER_ID}`,
        CUSTOMER_SHIPMENT_EVENT,
        {
          orderId: ORDER_ID,
          shipmentId: SHIPMENT_ID,
          status: ShipmentStatus.out_for_delivery,
          awb: AWB,
          courier: 'Delhivery Surface',
          trackingUrl: 'https://track.test/1234567890',
        },
      );
    });

    it('skips the broadcast for a guest order with no customer', async () => {
      shipments.findByAwb.mockResolvedValue(
        shipmentFixture({
          order: { ...shipmentFixture().order, customer_id: null },
        }),
      );
      await service.handle(TOKEN, bodyFixture());
      await flush();
      expect(pusher.trigger).not.toHaveBeenCalled();
    });

    it('sends the WhatsApp template on out_for_delivery and delivered', async () => {
      await service.handle(TOKEN, bodyFixture());
      await flush();
      expect(whatsapp.sendTemplate).toHaveBeenCalledWith(
        '9876543210',
        SHIPMENT_WHATSAPP_TEMPLATE,
        [ShipmentStatus.out_for_delivery, AWB, 'Delhivery Surface'],
      );
    });

    it('does not send a WhatsApp template for an intermediate leg', async () => {
      shipments.findByAwb.mockResolvedValue(
        shipmentFixture({ status: ShipmentStatus.picked_up }),
      );
      await service.handle(
        TOKEN,
        bodyFixture({ current_status: 'IN TRANSIT' }),
      );
      await flush();
      expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
      expect(pusher.trigger).toHaveBeenCalled();
    });

    it('isolates both sends — a dead Pusher or WhatsApp cannot fail the webhook', async () => {
      pusher.trigger.mockRejectedValue(new Error('pusher down'));
      whatsapp.sendTemplate.mockRejectedValue(new Error('graph api 500'));

      await expect(service.handle(TOKEN, bodyFixture())).resolves.toMatchObject(
        { status: 'ok' },
      );
      await flush();
      expect(pusher.trigger).toHaveBeenCalled();
      expect(whatsapp.sendTemplate).toHaveBeenCalled();
    });
  });

  // ─── timestamp helper ─────────────────────────────────────────────────────

  describe('parseShiprocketTimestamp', () => {
    it("turns Shiprocket's space-separated local time into a Date", () => {
      expect(parseShiprocketTimestamp('2026-08-23 14:30:00')).toEqual(
        new Date('2026-08-23T14:30:00'),
      );
    });

    it('keeps an ISO instant intact', () => {
      expect(parseShiprocketTimestamp('2026-08-23T14:30:00.000Z')).toEqual(
        new Date('2026-08-23T14:30:00.000Z'),
      );
    });
  });
});
