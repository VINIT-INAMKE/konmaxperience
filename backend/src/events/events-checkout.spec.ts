import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { Prisma } from '@prisma/client';

describe('EventsService — Checkout & Confirm', () => {
  let service: EventsService;
  let prisma: any;
  let razorpay: any;

  const mockEvent = {
    id: 'evt-1',
    title: 'Test Event',
    capacity: 10,
    price: new Prisma.Decimal(500),
    date: new Date(Date.now() + 86400000), // tomorrow
    status: 'active',
  };

  const mockCustomer = {
    id: 'cust-1',
    name: 'Test Customer',
    phone: '+919999999999',
  };

  beforeEach(async () => {
    prisma = {
      event: {
        findUnique: jest.fn(),
      },
      eventBooking: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
    };

    razorpay = {
      createOrder: jest.fn(),
      verifyPaymentSignature: jest.fn(),
      fetchPayment: jest.fn(),
      createRefund: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RazorpayService, useValue: razorpay },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  // ---------------------------------------------------------------
  // checkoutEvent tests
  // ---------------------------------------------------------------
  describe('checkoutEvent', () => {
    it('should create booking directly for free event (price=0) with payment_status=free', async () => {
      const freeEvent = { ...mockEvent, price: new Prisma.Decimal(0) };
      prisma.event.findUnique.mockResolvedValue(freeEvent);
      prisma.eventBooking.aggregate.mockResolvedValue({ _sum: { guests: 0 } });
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      const mockBooking = { id: 'booking-1', payment_status: 'free', guests: 2 };
      prisma.eventBooking.create.mockResolvedValue(mockBooking);

      const result = await service.checkoutEvent('evt-1', 2, 'cust-1');

      expect(result.type).toBe('free');
      expect(result.booking).toEqual(mockBooking);
      expect(prisma.eventBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payment_status: 'free',
          payment_amount: 0,
          customer_id: 'cust-1',
        }),
      });
      expect(razorpay.createOrder).not.toHaveBeenCalled();
    });

    it('should create Razorpay order for paid event and return razorpay_order_id', async () => {
      prisma.event.findUnique.mockResolvedValue(mockEvent);
      prisma.eventBooking.aggregate.mockResolvedValue({ _sum: { guests: 0 } });
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      razorpay.createOrder.mockResolvedValue({ id: 'order_rzp_1', amount: 100000, currency: 'INR', status: 'created' });
      prisma.eventBooking.create.mockResolvedValue({ id: 'booking-1', payment_status: 'pending' });

      const result = await service.checkoutEvent('evt-1', 2, 'cust-1');

      expect(result.type).toBe('paid');
      expect(result.razorpay_order_id).toBe('order_rzp_1');
      expect(razorpay.createOrder).toHaveBeenCalledWith({
        amount: 100000, // 500 * 2 * 100 paise
        receipt: expect.stringContaining('evt_evt-1_'),
        notes: { type: 'event_booking', entity_id: 'evt-1' },
      });
      expect(prisma.eventBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          razorpay_order_id: 'order_rzp_1',
          payment_status: 'pending',
        }),
      });
    });

    it('should throw BadRequestException when capacity is full', async () => {
      prisma.event.findUnique.mockResolvedValue(mockEvent);
      prisma.eventBooking.aggregate.mockResolvedValue({ _sum: { guests: 10 } });

      await expect(service.checkoutEvent('evt-1', 1, 'cust-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when event date is in the past', async () => {
      const pastEvent = { ...mockEvent, date: new Date(Date.now() - 86400000) };
      prisma.event.findUnique.mockResolvedValue(pastEvent);

      await expect(service.checkoutEvent('evt-1', 2, 'cust-1'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------
  // confirmBooking tests
  // ---------------------------------------------------------------
  describe('confirmBooking', () => {
    const confirmDto = {
      razorpay_order_id: 'order_rzp_1',
      razorpay_payment_id: 'pay_rzp_1',
      razorpay_signature: 'valid_sig',
      guests: 2,
    };

    it('should verify signature, re-fetch payment, and update booking to paid', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({
        id: 'pay_rzp_1',
        status: 'captured',
        order_id: 'order_rzp_1',
        amount: 100000,
      });
      const pendingBooking = { id: 'booking-1', razorpay_order_id: 'order_rzp_1', customer_id: 'cust-1', payment_status: 'pending', customer_name: 'Test', guests: 2 };
      prisma.eventBooking.findFirst.mockResolvedValue(pendingBooking);
      // capacity 10 - 2 confirmed = 8 spots remaining >= 2 requested -> no refund
      prisma.eventBooking.aggregate.mockResolvedValue({ _sum: { guests: 2 } });
      prisma.event.findUnique.mockResolvedValue(mockEvent);
      const updatedBooking = { ...pendingBooking, payment_status: 'paid', razorpay_payment_id: 'pay_rzp_1' };
      prisma.eventBooking.update.mockResolvedValue(updatedBooking);
      prisma.eventBooking.findUnique.mockResolvedValue(updatedBooking);

      const result = await service.confirmBooking('evt-1', confirmDto, 'cust-1');

      expect(razorpay.verifyPaymentSignature).toHaveBeenCalledWith('order_rzp_1', 'pay_rzp_1', 'valid_sig');
      expect(razorpay.fetchPayment).toHaveBeenCalledWith('pay_rzp_1');
      expect(result!.payment_status).toBe('paid');
    });

    it('should throw BadRequestException for invalid HMAC signature', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(false);

      await expect(service.confirmBooking('evt-1', confirmDto, 'cust-1'))
        .rejects.toThrow(BadRequestException);
      expect(razorpay.fetchPayment).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when payment status is neither captured nor authorized', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({
        id: 'pay_rzp_1',
        status: 'failed',
        order_id: 'order_rzp_1',
        amount: 100000,
      });

      await expect(service.confirmBooking('evt-1', confirmDto, 'cust-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when order_id mismatch', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({
        id: 'pay_rzp_1',
        status: 'captured',
        order_id: 'order_rzp_different',
        amount: 100000,
      });

      await expect(service.confirmBooking('evt-1', confirmDto, 'cust-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should return existing booking if already paid (idempotent)', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({
        id: 'pay_rzp_1',
        status: 'captured',
        order_id: 'order_rzp_1',
        amount: 100000,
      });
      const paidBooking = { id: 'booking-1', payment_status: 'paid', razorpay_order_id: 'order_rzp_1', customer_id: 'cust-1' };
      prisma.eventBooking.findFirst.mockResolvedValue(paidBooking);

      const result = await service.confirmBooking('evt-1', confirmDto, 'cust-1');

      expect(result).toEqual(paidBooking);
      expect(prisma.eventBooking.update).not.toHaveBeenCalled();
    });

    it('should trigger auto-refund and throw when capacity exceeded after payment', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({
        id: 'pay_rzp_1',
        status: 'captured',
        order_id: 'order_rzp_1',
        amount: 100000,
      });
      const pendingBooking = { id: 'booking-1', razorpay_order_id: 'order_rzp_1', customer_id: 'cust-1', payment_status: 'pending', customer_name: 'Test', guests: 2 };
      prisma.eventBooking.findFirst.mockResolvedValue(pendingBooking);
      // Capacity already full (10 confirmed guests, capacity is 10) -> 0 spots < 2 requested
      prisma.eventBooking.aggregate.mockResolvedValue({ _sum: { guests: 10 } });
      prisma.event.findUnique.mockResolvedValue(mockEvent);
      razorpay.createRefund.mockResolvedValue({ id: 'rfnd_1' });
      prisma.eventBooking.update.mockResolvedValue({ ...pendingBooking, payment_status: 'refunded' });

      await expect(service.confirmBooking('evt-1', confirmDto, 'cust-1'))
        .rejects.toThrow(BadRequestException);

      expect(razorpay.createRefund).toHaveBeenCalledWith('pay_rzp_1', 100000, 'capacity_exceeded');
      expect(prisma.eventBooking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { payment_status: 'refunded' },
      });
    });
  });
});
