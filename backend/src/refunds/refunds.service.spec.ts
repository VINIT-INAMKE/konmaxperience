import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ActorType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import {
  LOYALTY_REVERSAL_NOTE,
  RECONCILED_REFUND_REASON,
  RefundsService,
  type GatewayRefundEntity,
} from './refunds.service';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { AuditService, type AuditInput } from '../audit/audit.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import {
  MockPrisma,
  mockAuditService,
  mockPrisma,
  mockRazorpay,
} from '../test-utils/mock-providers';

const ORDER_ID = '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f601';
const PAYMENT_ROW_ID = 'payment-row-1';
const USER_ID = 'user-1';
const CUSTOMER_ID = 'customer-1';

/**
 * The nth argument of the nth call, typed. `jest.Mock['mock']['calls']` is
 * `any[][]`, so every direct index trips four `no-unsafe-*` rules; funnelling
 * them through one helper confines the cast to a single line.
 */
function callArg<T>(fn: jest.Mock, argIndex = 0, callIndex = 0): T {
  return fn.mock.calls[callIndex][argIndex] as T;
}

/** A ₹1,000 Razorpay payment with nothing refunded yet. */
function paymentRow(over: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ROW_ID,
    order_id: ORDER_ID,
    method: PaymentMethod.razorpay,
    amount: new Prisma.Decimal('1000.00'),
    status: PaymentStatus.paid,
    refunded_amount: new Prisma.Decimal('0.00'),
    razorpay_order_id: 'order_Abc',
    razorpay_payment_id: 'pay_Abc',
    ...over,
  };
}

function refundEntity(over: Partial<GatewayRefundEntity> = {}) {
  return {
    id: 'rfnd_Abc',
    payment_id: 'pay_Abc',
    amount: 100_000,
    ...over,
  } as GatewayRefundEntity;
}

/** `_sum.amount` as Prisma returns it — a `Decimal`, or `null` when no row matched. */
function processedTotal(rupees: string | null) {
  return {
    _sum: { amount: rupees === null ? null : new Prisma.Decimal(rupees) },
  };
}

describe('RefundsService', () => {
  let service: RefundsService;
  let prisma: MockPrisma;
  let razorpay: ReturnType<typeof mockRazorpay>;
  let audit: ReturnType<typeof mockAuditService>;
  let loyalty: { reverse: jest.Mock };

  beforeEach(async () => {
    prisma = mockPrisma();
    razorpay = mockRazorpay();
    audit = mockAuditService();
    loyalty = { reverse: jest.fn().mockResolvedValue(null) };

    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      payment: paymentRow(),
    });
    prisma.order.update.mockResolvedValue({
      id: ORDER_ID,
      customer_id: CUSTOMER_ID,
    });
    prisma.payment.findFirst.mockResolvedValue(paymentRow());
    prisma.payment.update.mockResolvedValue(paymentRow());
    prisma.refund.findUnique.mockResolvedValue(null);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.refund.aggregate.mockResolvedValue(processedTotal(null));
    prisma.refund.create.mockImplementation((args: any) =>
      Promise.resolve({ id: 'refund-row-1', ...args.data }),
    );
    prisma.refund.update.mockImplementation((args: any) =>
      Promise.resolve({ id: args.where.id, ...args.data }),
    );
    prisma.refund.delete.mockResolvedValue({ id: 'refund-row-1' });
    razorpay.createRefund.mockResolvedValue({ id: 'rfnd_Abc' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RazorpayService, useValue: razorpay },
        { provide: AuditService, useValue: audit },
        { provide: LoyaltyService, useValue: loyalty },
      ],
    }).compile();

    service = moduleRef.get(RefundsService);
  });

  // ---------------------------------------------------------------
  // POST /orders/:id/refund — guards
  // ---------------------------------------------------------------

  it('404s when the order does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(
      service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an order with no payment to refund', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: ORDER_ID, payment: null });

    await expect(
      service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID),
    ).rejects.toThrow('This order has no payment to refund');
    expect(razorpay.createRefund).not.toHaveBeenCalled();
  });

  it('rejects a payment that was never captured', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      payment: paymentRow({ status: PaymentStatus.pending }),
    });

    await expect(
      service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID),
    ).rejects.toThrow('Cannot refund a payment with status pending');
  });

  it('rejects a non-Razorpay payment method with an explicit message', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      payment: paymentRow({
        method: PaymentMethod.cash,
        razorpay_payment_id: null,
      }),
    });

    await expect(
      service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID),
    ).rejects.toThrow(
      'Only Razorpay payments can be refunded from here — record cash/UPI refunds manually',
    );
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it('rejects an amount above the refundable balance, naming the balance', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      payment: paymentRow({
        status: PaymentStatus.partially_refunded,
        refunded_amount: new Prisma.Decimal('250.00'),
      }),
    });

    await expect(
      service.refund(
        ORDER_ID,
        { amount: 800, reason: 'Damaged in transit' },
        USER_ID,
      ),
    ).rejects.toThrow('Only ₹750.00 is left to refund on this order');
    expect(razorpay.createRefund).not.toHaveBeenCalled();
  });

  it('rejects a refund on a payment that is already fully refunded', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      payment: paymentRow({
        status: PaymentStatus.partially_refunded,
        refunded_amount: new Prisma.Decimal('1000.00'),
      }),
    });

    await expect(
      service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID),
    ).rejects.toThrow('Refund amount must be greater than zero');
  });

  // ---------------------------------------------------------------
  // POST /orders/:id/refund — the money
  // ---------------------------------------------------------------

  it('opens a pending Refund row before calling the gateway and processes it after', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('1000.00'));

    await service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID);

    const created = callArg<{ data: Record<string, unknown> }>(
      prisma.refund.create,
    ).data;
    expect(created).toMatchObject({
      order_id: ORDER_ID,
      payment_id: PAYMENT_ROW_ID,
      reason: 'Damaged in transit',
      status: RefundStatus.pending,
      requested_by: USER_ID,
    });
    expect(prisma.refund.create.mock.invocationCallOrder[0]).toBeLessThan(
      razorpay.createRefund.mock.invocationCallOrder[0],
    );

    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.refund.update).data,
    ).toEqual({
      status: RefundStatus.processed,
      razorpay_refund_id: 'rfnd_Abc',
    });
  });

  it('sends the gateway integer paise, not rupees', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('649.50'));

    await service.refund(
      ORDER_ID,
      { amount: 649.5, reason: 'Damaged in transit' },
      USER_ID,
    );

    expect(razorpay.createRefund).toHaveBeenCalledWith(
      'pay_Abc',
      64_950,
      'Damaged in transit',
    );
  });

  it('refunds the whole remaining balance when amount is omitted', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      payment: paymentRow({
        status: PaymentStatus.partially_refunded,
        refunded_amount: new Prisma.Decimal('250.00'),
      }),
    });
    prisma.refund.aggregate.mockResolvedValue(processedTotal('1000.00'));

    await service.refund(ORDER_ID, { reason: 'Goodwill' }, USER_ID);

    expect(razorpay.createRefund).toHaveBeenCalledWith(
      'pay_Abc',
      75_000,
      'Goodwill',
    );
  });

  it('marks a full refund as refunded on both the payment and the order', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('1000.00'));

    await service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID);

    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.payment.update),
    ).toMatchObject({
      where: { id: PAYMENT_ROW_ID },
      data: {
        refunded_amount: new Prisma.Decimal('1000.00'),
        status: PaymentStatus.refunded,
      },
    });
    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.order.update),
    ).toMatchObject({
      where: { id: ORDER_ID },
      data: { status: OrderStatus.refunded, updated_by: USER_ID },
    });
  });

  it('leaves the order alone on a partial refund and flags the payment partially_refunded', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('200.00'));

    await service.refund(
      ORDER_ID,
      { amount: 200, reason: 'Short delivery' },
      USER_ID,
    );

    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.payment.update),
    ).toMatchObject({
      data: {
        refunded_amount: new Prisma.Decimal('200.00'),
        status: PaymentStatus.partially_refunded,
      },
    });
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(loyalty.reverse).not.toHaveBeenCalled();
  });

  it('accumulates refunded_amount across two partial refunds', async () => {
    prisma.refund.aggregate
      .mockResolvedValueOnce(processedTotal('200.00'))
      .mockResolvedValueOnce(processedTotal('500.00'));

    await service.refund(
      ORDER_ID,
      { amount: 200, reason: 'Short delivery' },
      USER_ID,
    );
    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      payment: paymentRow({
        status: PaymentStatus.partially_refunded,
        refunded_amount: new Prisma.Decimal('200.00'),
      }),
    });
    await service.refund(
      ORDER_ID,
      { amount: 300, reason: 'Second short delivery' },
      USER_ID,
    );

    expect(prisma.payment.update).toHaveBeenCalledTimes(2);
    expect(
      callArg<{ data: { refunded_amount: Prisma.Decimal; status: string } }>(
        prisma.payment.update,
        0,
        1,
      ).data,
    ).toMatchObject({
      refunded_amount: new Prisma.Decimal('500.00'),
      status: PaymentStatus.partially_refunded,
    });
  });

  it('claws the loyalty points back once the order is fully refunded', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('1000.00'));

    await service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID);

    expect(loyalty.reverse).toHaveBeenCalledWith(
      prisma,
      CUSTOMER_ID,
      ORDER_ID,
      LOYALTY_REVERSAL_NOTE,
    );
  });

  it('skips the loyalty claw-back for a POS order with no customer', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('1000.00'));
    prisma.order.update.mockResolvedValue({
      id: ORDER_ID,
      customer_id: null,
    });

    await service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID);

    expect(loyalty.reverse).not.toHaveBeenCalled();
  });

  it('writes an order.refunded audit event inside the transaction', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('200.00'));

    await service.refund(
      ORDER_ID,
      { amount: 200, reason: 'Short delivery' },
      USER_ID,
    );

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(callArg<unknown>(audit.record, 0)).toBe(prisma);
    const input = callArg<AuditInput>(audit.record, 1);
    expect(input).toMatchObject({
      entity_type: 'order',
      entity_id: ORDER_ID,
      action: 'order.refunded',
      actor_type: ActorType.user,
      actor_id: USER_ID,
    });
    expect(input.before).toMatchObject({
      refunded_amount: '0.00',
      payment_status: PaymentStatus.paid,
    });
    expect(input.after).toMatchObject({
      refunded_amount: '200.00',
      payment_status: PaymentStatus.partially_refunded,
      amount: '200.00',
      reason: 'Short delivery',
      razorpay_refund_id: 'rfnd_Abc',
    });
  });

  it('leaves the Refund failed and the payment untouched when the gateway rejects', async () => {
    razorpay.createRefund.mockRejectedValue(
      new Error('Refund amount exceeds balance'),
    );

    await expect(
      service.refund(ORDER_ID, { reason: 'Damaged in transit' }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.refund.update).data,
    ).toEqual({ status: RefundStatus.failed });
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('drops its duplicate row when the webhook claimed the gateway id first', async () => {
    const claimed = {
      id: 'refund-row-webhook',
      razorpay_refund_id: 'rfnd_Abc',
      status: RefundStatus.processed,
    };
    prisma.refund.findUnique.mockResolvedValue(claimed);

    const result = await service.refund(
      ORDER_ID,
      { reason: 'Damaged in transit' },
      USER_ID,
    );

    expect(result).toEqual(claimed);
    expect(prisma.refund.delete).toHaveBeenCalledWith({
      where: { id: 'refund-row-1' },
    });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------
  // refund.processed reconciliation
  // ---------------------------------------------------------------

  it('ignores a refund whose payment is unknown', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await service.reconcileGatewayRefund(refundEntity());

    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('is a no-op on a redelivery of an already processed refund', async () => {
    prisma.refund.findUnique.mockResolvedValue({
      id: 'refund-row-1',
      status: RefundStatus.processed,
    });

    await service.reconcileGatewayRefund(refundEntity());

    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(prisma.refund.update).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('creates a reconciliation-only row for a refund this system never opened', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('250.00'));

    await service.reconcileGatewayRefund(
      refundEntity({ amount: 25_000, notes: null }),
    );

    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.refund.create).data,
    ).toMatchObject({
      order_id: ORDER_ID,
      payment_id: PAYMENT_ROW_ID,
      amount: new Prisma.Decimal('250.00'),
      reason: RECONCILED_REFUND_REASON,
      razorpay_refund_id: 'rfnd_Abc',
      status: RefundStatus.processed,
    });
  });

  it('carries the gateway note through as the reason when Razorpay sends one', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('250.00'));

    await service.reconcileGatewayRefund(
      refundEntity({ amount: 25_000, notes: { reason: 'Damaged in transit' } }),
    );

    expect(
      callArg<{ data: { reason: string } }>(prisma.refund.create).data.reason,
    ).toBe('Damaged in transit');
  });

  it('promotes the pending row a staff refund opened instead of duplicating it', async () => {
    prisma.refund.findUnique.mockResolvedValue({
      id: 'refund-row-1',
      status: RefundStatus.pending,
    });
    prisma.refund.aggregate.mockResolvedValue(processedTotal('250.00'));

    await service.reconcileGatewayRefund(refundEntity({ amount: 25_000 }));

    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(prisma.refund.update).toHaveBeenCalledWith({
      where: { id: 'refund-row-1' },
      data: { status: RefundStatus.processed },
    });
  });

  it('sets partially_refunded and leaves the order alone on a partial gateway refund', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('250.00'));

    await service.reconcileGatewayRefund(refundEntity({ amount: 25_000 }));

    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.payment.update),
    ).toMatchObject({
      where: { id: PAYMENT_ROW_ID },
      data: {
        refunded_amount: new Prisma.Decimal('250.00'),
        status: PaymentStatus.partially_refunded,
      },
    });
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(loyalty.reverse).not.toHaveBeenCalled();
  });

  it('flips payment and order to refunded and reverses loyalty on a full gateway refund', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('1000.00'));

    await service.reconcileGatewayRefund(refundEntity());

    expect(
      callArg<{ data: { status: string } }>(prisma.payment.update).data.status,
    ).toBe(PaymentStatus.refunded);
    const orderUpdate = callArg<{
      where: { id: string };
      data: Record<string, unknown>;
    }>(prisma.order.update);
    expect(orderUpdate.where).toEqual({ id: ORDER_ID });
    expect(orderUpdate.data).toEqual({ status: OrderStatus.refunded });
    expect(loyalty.reverse).toHaveBeenCalledWith(
      prisma,
      CUSTOMER_ID,
      ORDER_ID,
      LOYALTY_REVERSAL_NOTE,
    );
  });

  it('writes an order.refund_reconciled audit event with a system actor', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('250.00'));

    await service.reconcileGatewayRefund(refundEntity({ amount: 25_000 }));

    const input = callArg<AuditInput>(audit.record, 1);
    expect(input).toMatchObject({
      entity_type: 'order',
      entity_id: ORDER_ID,
      action: 'order.refund_reconciled',
      actor_type: ActorType.system,
      actor_id: null,
    });
    expect(input.after).toMatchObject({
      razorpay_refund_id: 'rfnd_Abc',
      refunded_amount: '250.00',
      payment_status: PaymentStatus.partially_refunded,
    });
  });

  it('only ever sums the processed refunds of that payment', async () => {
    prisma.refund.aggregate.mockResolvedValue(processedTotal('250.00'));

    await service.reconcileGatewayRefund(refundEntity({ amount: 25_000 }));

    expect(prisma.refund.aggregate).toHaveBeenCalledWith({
      where: { payment_id: PAYMENT_ROW_ID, status: RefundStatus.processed },
      _sum: { amount: true },
    });
  });

  // ---------------------------------------------------------------
  // GET /orders/:id/refunds + DTO
  // ---------------------------------------------------------------

  it('lists an order refund ledger newest first', async () => {
    await service.list(ORDER_ID);

    expect(prisma.refund.findMany).toHaveBeenCalledWith({
      where: { order_id: ORDER_ID },
      orderBy: { created_at: 'desc' },
    });
  });

  it('CreateRefundDto rejects a sub-paise amount and a missing reason', async () => {
    const bad = plainToInstance(CreateRefundDto, { amount: 10.001 });
    const errors = await validate(bad);
    expect(errors.map((e) => e.property).sort()).toEqual(['amount', 'reason']);

    const good = plainToInstance(CreateRefundDto, {
      amount: 649.5,
      reason: 'Damaged in transit',
    });
    expect(await validate(good)).toHaveLength(0);
  });
});
