import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

// Mock Razorpay constructor at module level (before import)
const mockOrdersCreate = jest.fn();
const mockPaymentsFetch = jest.fn();
const mockPaymentsRefund = jest.fn();

jest.mock('razorpay', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    orders: { create: mockOrdersCreate },
    payments: { fetch: mockPaymentsFetch, refund: mockPaymentsRefund },
  })),
}));

import { RazorpayService } from './razorpay.service';

describe('RazorpayService', () => {
  let service: RazorpayService;

  const TEST_KEY_ID = 'rzp_test_abc123';
  const TEST_KEY_SECRET = 'test_secret_key_12345678';
  const TEST_WEBHOOK_SECRET = 'whsec_test_webhook_secret_12345';

  beforeEach(async () => {
    mockOrdersCreate.mockReset();
    mockPaymentsFetch.mockReset();
    mockPaymentsRefund.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                RAZORPAY_KEY_ID: TEST_KEY_ID,
                RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
                RAZORPAY_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RazorpayService>(RazorpayService);
    service.onModuleInit();
  });

  it('should create an order with correct paise amount and notes', async () => {
    const mockOrder = { id: 'order_abc123', amount: 50000, currency: 'INR' };
    mockOrdersCreate.mockResolvedValue(mockOrder);

    const result = await service.createOrder({
      amount: 50000,
      receipt: 'evt_123_1234567890',
      notes: { type: 'event_booking', entity_id: 'uuid-123' },
    });

    expect(mockOrdersCreate).toHaveBeenCalledWith({
      amount: 50000,
      currency: 'INR',
      receipt: 'evt_123_1234567890',
      notes: { type: 'event_booking', entity_id: 'uuid-123' },
    });
    expect(result).toEqual(mockOrder);
  });

  it('should verify payment signature correctly for valid HMAC', () => {
    const orderId = 'order_test123';
    const paymentId = 'pay_test456';
    // Generate a valid signature using the same HMAC algorithm Razorpay uses
    const body = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(body)
      .digest('hex');

    const result = service.verifyPaymentSignature(orderId, paymentId, validSignature);
    expect(result).toBe(true);
  });

  it('should return false for tampered payment signature', () => {
    const result = service.verifyPaymentSignature(
      'order_test123',
      'pay_test456',
      'invalid_signature_here',
    );
    expect(result).toBe(false);
  });

  it('should verify webhook signature correctly for valid raw body', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured', payload: {} });
    const validSignature = crypto
      .createHmac('sha256', TEST_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const result = service.verifyWebhookSignature(rawBody, validSignature);
    expect(result).toBe(true);
  });

  it('should return false for invalid webhook signature', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured', payload: {} });
    const result = service.verifyWebhookSignature(rawBody, 'bad_signature');
    expect(result).toBe(false);
  });

  it('should fetch payment by paymentId', async () => {
    const mockPayment = { id: 'pay_abc', amount: 50000, status: 'captured' };
    mockPaymentsFetch.mockResolvedValue(mockPayment);

    const result = await service.fetchPayment('pay_abc');

    expect(mockPaymentsFetch).toHaveBeenCalledWith('pay_abc');
    expect(result).toEqual(mockPayment);
  });

  it('should create refund with paise amount and reason notes', async () => {
    const mockRefund = { id: 'rfnd_abc', amount: 25000 };
    mockPaymentsRefund.mockResolvedValue(mockRefund);

    const result = await service.createRefund('pay_abc', 25000, 'Customer requested');

    expect(mockPaymentsRefund).toHaveBeenCalledWith('pay_abc', {
      amount: 25000,
      speed: 'optimum',
      notes: { reason: 'Customer requested' },
      receipt: expect.stringMatching(/^refund_\d+$/),
    });
    expect(result).toEqual(mockRefund);
  });

  it('should throw BadRequestException when Razorpay is not configured', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    const unconfiguredService = module.get<RazorpayService>(RazorpayService);
    unconfiguredService.onModuleInit();

    await expect(unconfiguredService.createOrder({
      amount: 50000,
      receipt: 'test',
      notes: { type: 'event_booking', entity_id: '123' },
    })).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for verifyPaymentSignature when not configured', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    const unconfiguredService = module.get<RazorpayService>(RazorpayService);
    unconfiguredService.onModuleInit();

    expect(() => {
      unconfiguredService.verifyPaymentSignature('order_1', 'pay_1', 'sig');
    }).toThrow(BadRequestException);
  });
});
