import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { Prisma } from '@prisma/client';

describe('OrdersService — Razorpay', () => {
  let service: OrdersService;
  let prisma: any;
  let razorpay: any;

  const mockOrder = {
    id: 'order-1',
    order_number: 'ORD-001',
    total: new Prisma.Decimal(1500),
    status: 'placed',
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    razorpay = {
      createOrder: jest.fn(),
      verifyPaymentSignature: jest.fn(),
      fetchPayment: jest.fn(),
    };

    const mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RazorpayService, useValue: razorpay },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  // ---------------------------------------------------------------
  // createRazorpayOrder tests
  // ---------------------------------------------------------------
  describe('createRazorpayOrder', () => {
    it('should call razorpayService.createOrder with amount in paise from order.total', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.payment.findFirst.mockResolvedValue(null);
      razorpay.createOrder.mockResolvedValue({ id: 'order_rzp_1', amount: 150000, currency: 'INR', status: 'created' });
      prisma.payment.upsert.mockResolvedValue({ id: 'pay-1', status: 'pending' });

      const result = await service.createRazorpayOrder('order-1');

      expect(razorpay.createOrder).toHaveBeenCalledWith({
        amount: 150000, // 1500 * 100
        receipt: expect.stringContaining('ord_ORD-001_'),
        notes: { type: 'pos_order', entity_id: 'order-1' },
      });
      expect(result.razorpay_order_id).toBe('order_rzp_1');
    });

    it('should throw BadRequestException when order already has a paid payment', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'paid' });

      await expect(service.createRazorpayOrder('order-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should upsert pending Payment record with razorpay_order_id', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.payment.findFirst.mockResolvedValue(null);
      razorpay.createOrder.mockResolvedValue({ id: 'order_rzp_1', amount: 150000, currency: 'INR', status: 'created' });
      prisma.payment.upsert.mockResolvedValue({ id: 'pay-1', status: 'pending', razorpay_order_id: 'order_rzp_1' });

      await service.createRazorpayOrder('order-1');

      expect(prisma.payment.upsert).toHaveBeenCalledWith({
        where: { order_id: 'order-1' },
        create: expect.objectContaining({
          order_id: 'order-1',
          method: 'razorpay',
          status: 'pending',
          razorpay_order_id: 'order_rzp_1',
        }),
        update: expect.objectContaining({
          method: 'razorpay',
          razorpay_order_id: 'order_rzp_1',
          status: 'pending',
        }),
      });
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.createRazorpayOrder('order-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------
  // confirmRazorpayPayment tests
  // ---------------------------------------------------------------
  describe('confirmRazorpayPayment', () => {
    const confirmDto = {
      razorpay_order_id: 'order_rzp_1',
      razorpay_payment_id: 'pay_rzp_1',
      razorpay_signature: 'valid_sig',
    };

    it('should verify signature, re-fetch payment, and update Payment to paid', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({
        id: 'pay_rzp_1',
        status: 'captured',
        order_id: 'order_rzp_1',
        amount: 150000,
      });
      const pendingPayment = { id: 'pay-1', order_id: 'order-1', status: 'pending', razorpay_order_id: 'order_rzp_1' };
      prisma.payment.findFirst.mockResolvedValue(pendingPayment);
      const updatedPayment = { ...pendingPayment, status: 'paid', razorpay_payment_id: 'pay_rzp_1' };
      prisma.payment.update.mockResolvedValue(updatedPayment);

      const result = await service.confirmRazorpayPayment('order-1', confirmDto);

      expect(razorpay.verifyPaymentSignature).toHaveBeenCalledWith('order_rzp_1', 'pay_rzp_1', 'valid_sig');
      expect(razorpay.fetchPayment).toHaveBeenCalledWith('pay_rzp_1');
      expect(result.status).toBe('paid');
    });

    it('should throw BadRequestException for invalid HMAC signature', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(false);

      await expect(service.confirmRazorpayPayment('order-1', confirmDto))
        .rejects.toThrow(BadRequestException);
      expect(razorpay.fetchPayment).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when payment status is not captured', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({
        id: 'pay_rzp_1',
        status: 'authorized',
        order_id: 'order_rzp_1',
        amount: 150000,
      });

      await expect(service.confirmRazorpayPayment('order-1', confirmDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should return existing payment if already paid (idempotent)', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({
        id: 'pay_rzp_1',
        status: 'captured',
        order_id: 'order_rzp_1',
        amount: 150000,
      });
      const paidPayment = { id: 'pay-1', order_id: 'order-1', status: 'paid', razorpay_order_id: 'order_rzp_1' };
      prisma.payment.findFirst.mockResolvedValue(paidPayment);

      const result = await service.confirmRazorpayPayment('order-1', confirmDto);

      expect(result).toEqual(paidPayment);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when no payment record found for order', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({
        id: 'pay_rzp_1',
        status: 'captured',
        order_id: 'order_rzp_1',
        amount: 150000,
      });
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.confirmRazorpayPayment('order-1', confirmDto))
        .rejects.toThrow(NotFoundException);
    });
  });
});
