import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { RedisService } from '../customer-auth/redis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let razorpayService: RazorpayService;
  let mockRedisClient: { set: jest.Mock };
  let mockPrisma: any;

  beforeEach(async () => {
    mockRedisClient = {
      set: jest.fn(),
    };

    mockPrisma = {
      eventBooking: {
        findFirst: jest.fn(),
        update: jest.fn(),
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
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    razorpayService = module.get<RazorpayService>(RazorpayService);
  });

  it('should call verifyWebhookSignature with raw body string', async () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', notes: { type: 'event_booking', entity_id: '123' } } } } }));
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
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(false);

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
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', notes: { type: 'event_booking', entity_id: '123' } } } },
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

    const mockBooking = { id: 'bk-1', payment_status: 'pending' };
    mockPrisma.eventBooking.findFirst.mockResolvedValue(mockBooking);
    mockPrisma.eventBooking.update.mockResolvedValue({ ...mockBooking, payment_status: 'paid' });

    await service.processWebhook(rawBody, 'sig', 'evt_routing_1');

    expect(mockPrisma.eventBooking.findFirst).toHaveBeenCalledWith({
      where: { razorpay_order_id: 'order_booking_1' },
    });
    expect(mockPrisma.eventBooking.update).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
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

    // Booking already paid
    mockPrisma.eventBooking.findFirst.mockResolvedValue({ id: 'bk-1', payment_status: 'paid' });

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
    mockPrisma.eventBooking.update.mockResolvedValue({ ...mockBooking, payment_status: 'refunded' });

    await service.processWebhook(rawBody, 'sig', 'evt_refund_1');

    expect(mockPrisma.eventBooking.update).toHaveBeenCalledWith({
      where: { id: 'bk-rfnd' },
      data: { payment_status: 'refunded' },
    });
  });
});
