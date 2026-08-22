import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { RedisService } from '../customer-auth/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../chat/pusher.service';
import { FulfilmentService } from '../fulfilment/fulfilment.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let razorpayService: RazorpayService;
  let mockRedisClient: { set: jest.Mock; getdel: jest.Mock; del: jest.Mock };
  let mockPrisma: any;
  let mockPusher: { trigger: jest.Mock };
  let mockFulfilment: {
    confirmPaidOrder: jest.Mock;
    findOrderByRazorpayPaymentId: jest.Mock;
  };

  beforeEach(async () => {
    mockRedisClient = {
      set: jest.fn(),
      getdel: jest.fn(),
      del: jest.fn(),
    };

    mockPusher = { trigger: jest.fn().mockResolvedValue(undefined) };

    mockFulfilment = {
      confirmPaidOrder: jest.fn(),
      findOrderByRazorpayPaymentId: jest.fn().mockResolvedValue(null),
    };

    mockPrisma = {
      eventBooking: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: RazorpayService,
          useValue: {
            verifyWebhookSignature: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        { provide: PusherService, useValue: mockPusher },
        { provide: FulfilmentService, useValue: mockFulfilment },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    razorpayService = module.get<RazorpayService>(RazorpayService);
  });

  it('should call verifyWebhookSignature with raw body string', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_1',
              order_id: 'order_1',
              notes: { type: 'event_booking', entity_id: '123' },
            },
          },
        },
      }),
    );
    const signature = 'valid_sig';
    const eventId = 'evt_id_1';

    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    mockRedisClient.set.mockResolvedValue('OK');
    mockPrisma.eventBooking.findFirst.mockResolvedValue(null);

    await service.processWebhook(rawBody, signature, eventId);

    expect(razorpayService.verifyWebhookSignature).toHaveBeenCalledWith(
      rawBody.toString(),
      signature,
    );
  });

  it('should throw UnauthorizedException for invalid signature', async () => {
    const rawBody = Buffer.from('{}');
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
      false,
    );

    await expect(
      service.processWebhook(rawBody, 'bad_sig', 'evt_1'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for missing raw body', async () => {
    await expect(
      service.processWebhook(undefined, 'sig', 'evt_1'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should deduplicate by event_id using Redis SET NX', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_1',
            order_id: 'order_1',
            notes: { type: 'event_booking', entity_id: '123' },
          },
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

    // First call — new event
    mockRedisClient.set.mockResolvedValue('OK');
    mockPrisma.eventBooking.findFirst.mockResolvedValue(null);
    const first = await service.processWebhook(rawBody, 'sig', 'evt_dedup_1');
    expect(first.status).toBe('ok');

    // Second call — duplicate
    mockRedisClient.set.mockResolvedValue(null);
    const second = await service.processWebhook(rawBody, 'sig', 'evt_dedup_1');
    expect(second.status).toBe('duplicate');

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'webhook_processed:evt_dedup_1',
      '1',
      'EX',
      86400,
      'NX',
    );
  });

  it('should route payment.captured with notes.type=event_booking to handleEventBookingPayment', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_booking_1',
            order_id: 'order_booking_1',
            amount: 100000,
            notes: { type: 'event_booking', entity_id: 'evt-uuid-123' },
          },
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    mockRedisClient.set.mockResolvedValue('OK');

    mockPrisma.eventBooking.updateMany.mockResolvedValue({ count: 1 });

    await service.processWebhook(rawBody, 'sig', 'evt_routing_1');

    // Atomic idempotent update — only touches bookings not already paid
    expect(mockPrisma.eventBooking.updateMany).toHaveBeenCalledWith({
      where: {
        razorpay_order_id: 'order_booking_1',
        payment_status: { not: 'paid' },
      },
      data: {
        payment_status: 'paid',
        razorpay_payment_id: 'pay_booking_1',
      },
    });
  });

  it('should route payment.captured with notes.type=pos_order to handlePosOrderPayment', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_pos_1',
            order_id: 'order_pos_1',
            amount: 50000,
            notes: { type: 'pos_order', entity_id: 'order-uuid-123' },
          },
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    mockRedisClient.set.mockResolvedValue('OK');

    // No existing payment
    mockPrisma.payment.findFirst.mockResolvedValue(null);
    mockPrisma.payment.create.mockResolvedValue({ id: 'pay-new' });
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });

    await service.processWebhook(rawBody, 'sig', 'evt_pos_1');

    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: {
        order_id: 'order-uuid-123',
        method: 'razorpay',
        amount: 500, // 50000 paise / 100 = 500 rupees
        status: 'paid',
        razorpay_order_id: 'order_pos_1',
        razorpay_payment_id: 'pay_pos_1',
      },
    });

    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-uuid-123', status: 'placed' },
      data: { status: 'preparing' },
    });
  });

  it('should skip if event booking already paid (idempotent)', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_dup',
            order_id: 'order_dup',
            notes: { type: 'event_booking', entity_id: 'evt-1' },
          },
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    mockRedisClient.set.mockResolvedValue('OK');

    // Booking already paid — the WHERE clause matches nothing
    mockPrisma.eventBooking.updateMany.mockResolvedValue({ count: 0 });

    await service.processWebhook(rawBody, 'sig', 'evt_idempotent_1');

    expect(mockPrisma.eventBooking.update).not.toHaveBeenCalled();
  });

  it('should handle refund.processed and update booking status', async () => {
    const payload = {
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_1',
            payment_id: 'pay_refund_1',
            amount: 50000,
          },
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    mockRedisClient.set.mockResolvedValue('OK');

    const mockBooking = { id: 'bk-rfnd', payment_status: 'paid' };
    mockPrisma.eventBooking.findFirst.mockResolvedValue(mockBooking);
    mockPrisma.eventBooking.update.mockResolvedValue({
      ...mockBooking,
      payment_status: 'refunded',
    });

    await service.processWebhook(rawBody, 'sig', 'evt_refund_1');

    expect(mockPrisma.eventBooking.update).toHaveBeenCalledWith({
      where: { id: 'bk-rfnd' },
      data: { payment_status: 'refunded' },
    });
  });

  // ---------------------------------------------------------------
  // Marketplace backup path — routed through FulfilmentService
  // ---------------------------------------------------------------
  it('routes marketplace payment.captured through FulfilmentService.confirmPaidOrder', async () => {
    const pending = {
      customerId: 'cust-1',
      cart: {
        items: [
          {
            menuItemId: 'm1',
            name: 'Burger',
            quantity: 1,
            unitPrice: 300,
            imageUrl: null,
          },
        ],
      },
      subtotal: 300,
      modifierAmount: 0,
      total: 300,
      channel: 'takeaway',
      deliveryAddressId: null,
    };
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_m1',
            order_id: 'order_m1',
            amount: 30000,
            notes: { type: 'marketplace', entity_id: 'cust-1' },
          },
        },
      },
    };
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.getdel.mockResolvedValue(JSON.stringify(pending));
    mockFulfilment.confirmPaidOrder.mockResolvedValue({
      id: 'ord-1',
      order_number: 9,
    });

    await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      'sig',
      'evt_m1',
    );

    expect(mockRedisClient.getdel).toHaveBeenCalledWith(
      'pending_order:order_m1',
    );
    expect(mockFulfilment.confirmPaidOrder).toHaveBeenCalledWith({
      customerId: 'cust-1',
      razorpayOrderId: 'order_m1',
      razorpayPaymentId: 'pay_m1',
      pending,
      placedVia: 'webhook_fallback',
    });
    expect(mockRedisClient.del).toHaveBeenCalledWith('cart:cust-1');
    expect(mockPusher.trigger).toHaveBeenCalledWith(
      'private-customer-cust-1',
      'order.placed',
      expect.objectContaining({ orderId: 'ord-1' }),
    );
  });

  it('marketplace: skips when the payment id is already confirmed', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_m1',
            order_id: 'order_m1',
            amount: 30000,
            notes: { type: 'marketplace', entity_id: 'cust-1' },
          },
        },
      },
    };
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    mockRedisClient.set.mockResolvedValue('OK');
    mockFulfilment.findOrderByRazorpayPaymentId.mockResolvedValue({
      id: 'ord-1',
    });

    await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      'sig',
      'evt_m2',
    );

    expect(mockRedisClient.getdel).not.toHaveBeenCalled();
    expect(mockFulfilment.confirmPaidOrder).not.toHaveBeenCalled();
  });

  it('marketplace: restores the pending key on an amount mismatch', async () => {
    const pending = {
      customerId: 'cust-1',
      cart: { items: [] },
      subtotal: 300,
      modifierAmount: 0,
      total: 300,
      channel: 'takeaway',
      deliveryAddressId: null,
    };
    const raw = JSON.stringify(pending);
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_m3',
            order_id: 'order_m3',
            amount: 10000, // paid 100, expected 300
            notes: { type: 'marketplace', entity_id: 'cust-1' },
          },
        },
      },
    };
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.getdel.mockResolvedValue(raw);

    await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      'sig',
      'evt_m3',
    );

    expect(mockFulfilment.confirmPaidOrder).not.toHaveBeenCalled();
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'pending_order:order_m3',
      raw,
      'EX',
      1800,
      'NX',
    );
  });
});
