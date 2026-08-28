/**
 * `QA-05` — the core money path, against a real Postgres.
 *
 * `FulfilmentService.confirmPaidOrder` is the single "paid marketplace order"
 * write (`CHK-04`): the order, its items, the payment, the coupon redemption,
 * the loyalty spend and the audit row all commit inside one Serializable
 * transaction, or none of them do. Four phases of records say the unit suite
 * cannot prove that, and they are right — a mocked `PrismaService` has no
 * transaction, no isolation level, no unique index and no `CHECK`, so
 * `$transaction` there is a function that calls a callback.
 *
 * These four cases are the ones that need a database:
 *   1. the happy path really does leave all six writes behind,
 *   2. a failure late in the transaction leaves *nothing* behind — including
 *      the audit row and the coupon redemption written before it,
 *   3. a replayed payment resolves to the order that already exists instead of
 *      spending the loyalty points a second time, and
 *   4. two confirms racing for the same loyalty balance serialise.
 */
import { BadRequestException } from '@nestjs/common';
import {
  ActorType,
  CouponType,
  FulfilmentType,
  OrderChannel,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  ProductType,
} from '@prisma/client';
import type { PendingOrderV2 } from '../src/checkout/quote.types';
import { toPaise } from '../src/common/money/money';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestPrisma, truncateAll } from './integration-setup';
import {
  buildMoneyPathServices,
  type MoneyPathServices,
} from './integration-services';
import {
  seedCatalog,
  seedCoupon,
  seedCustomer,
  seedNode,
  type SeededCatalog,
} from './integration-fixtures';

// One line: 2 × ₹500.00 = ₹1000.00 gross, 5% inclusive GST carved out of it.
const UNIT_PRICE = 50_000;
const QUANTITY = 2;
const SUBTOTAL = UNIT_PRICE * QUANTITY; // 100_000 paise
const LINE_TAX = 4_762; // round(100000 × 5 / 105)
const COUPON_DISCOUNT = 10_000; // ₹100.00, a 10% coupon
const SHIPPING = 5_000; // ₹50.00
const LOYALTY_POINTS = 100;
const LOYALTY_AMOUNT = 10_000; // ₹100.00 — 1 point = ₹1
const TOTAL = SUBTOTAL - COUPON_DISCOUNT - LOYALTY_AMOUNT + SHIPPING; // 85_000

interface PendingOverrides {
  loyaltyPoints?: number;
  loyaltyAmount?: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  idempotencyKey?: string;
  coupon?: { id: string; code: string } | null;
}

/**
 * The frozen quote the customer paid against, in the exact shape the Redis
 * `pending_order:{rzp_order_id}` record carries. `confirmPaidOrder` never
 * re-prices it — every money field below is what the order is asserted on.
 */
function buildPending(
  catalog: SeededCatalog,
  customer: { customerId: string; addressId: string },
  overrides: PendingOverrides = {},
): PendingOrderV2 {
  const coupon = overrides.coupon === undefined ? null : overrides.coupon;
  const loyaltyPoints = overrides.loyaltyPoints ?? 0;
  const loyaltyAmount = overrides.loyaltyAmount ?? 0;
  const discount = coupon ? COUPON_DISCOUNT : 0;
  return {
    v: 2,
    razorpay_order_id: overrides.razorpayOrderId ?? 'order_INTEG0001',
    idempotency_key: overrides.idempotencyKey ?? 'idem-integ-0001',
    customer_id: customer.customerId,
    created_at: new Date().toISOString(),
    channel: OrderChannel.marketplace,
    delivery_address_id: customer.addressId,
    pickup: false,
    lines: [
      {
        product_id: catalog.productId,
        variant_id: null,
        name: 'Cold Brew Concentrate',
        sku: null,
        quantity: QUANTITY,
        type: ProductType.packaged,
        fulfilment: FulfilmentType.shipped,
        unit_price: UNIT_PRICE,
        gross: SUBTOTAL,
        tax_rate: '5.00',
        tax: LINE_TAX,
        weight_grams: 500,
        hsn_code: null,
        available: true,
        unavailable_reason: null,
        event_id: null,
      },
    ],
    holds: [],
    subtotal: SUBTOTAL,
    discount_amount: discount,
    coupon: coupon
      ? {
          id: coupon.id,
          code: coupon.code,
          type: CouponType.percent,
          discount: COUPON_DISCOUNT,
        }
      : null,
    shipping_amount: SHIPPING,
    shipping: null,
    tax_amount: LINE_TAX,
    tax_breakup: [
      { rate: '5.00', taxable: SUBTOTAL - LINE_TAX, tax: LINE_TAX },
    ],
    loyalty_points_redeemed: loyaltyPoints,
    loyalty_redeem_amount: loyaltyAmount,
    loyalty_points_earned_estimate: 0,
    total: SUBTOTAL - discount - loyaltyAmount + SHIPPING,
  };
}

describe('confirmPaidOrder (integration — real Postgres)', () => {
  let prisma: PrismaService;
  let services: MoneyPathServices;

  beforeAll(() => {
    prisma = createTestPrisma();
    services = buildMoneyPathServices(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  it('commits the order, payment, coupon redemption, loyalty spend and audit rows together', async () => {
    const { zoneId } = await seedNode(prisma);
    const catalog = await seedCatalog(prisma);
    const customer = await seedCustomer(prisma, { points: 500 });
    const coupon = await seedCoupon(prisma);

    const order = await services.fulfilment.confirmPaidOrder({
      customerId: customer.customerId,
      razorpayOrderId: 'order_INTEG0001',
      razorpayPaymentId: 'pay_INTEG0001',
      placedVia: OrderSource.storefront,
      pending: buildPending(catalog, customer, {
        coupon: { id: coupon.couponId, code: coupon.code },
        loyaltyPoints: LOYALTY_POINTS,
        loyaltyAmount: LOYALTY_AMOUNT,
      }),
    });

    // The order itself — the frozen quote, copied, not recomputed.
    expect(order.status).toBe(OrderStatus.placed);
    expect(order.placed_via).toBe(OrderSource.storefront);
    expect(order.zone_id).toBe(zoneId);
    expect(String(order.subtotal)).toBe('1000');
    // One `discount_amount` column carries the coupon *and* the loyalty spend.
    expect(String(order.discount_amount)).toBe('200');
    expect(String(order.shipping_amount)).toBe('50');
    expect(String(order.tax_amount)).toBe('47.62');
    expect(String(order.total)).toBe('850');
    // The Decimal column round-trips to exactly the paise the quote froze.
    expect(toPaise(order.total)).toBe(TOTAL);
    expect(order.loyalty_points_redeemed).toBe(LOYALTY_POINTS);
    expect(order.loyalty_points_earned).toBe(0); // earned on delivery, not on payment
    expect(order.coupon_id).toBe(coupon.couponId);
    expect(order.address_snapshot).toMatchObject({ pincode: '600096' });
    expect(order.delivery_address).toContain('12 Test Street');

    // The shipped line joined the pack queue inside the same transaction.
    const items = await prisma.orderItem.findMany({
      where: { order_id: order.id },
    });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(QUANTITY);
    expect(items[0].fulfilment).toBe(FulfilmentType.shipped);
    expect(items[0].status).toBe(OrderItemStatus.packed);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { order_id: order.id },
    });
    expect(payment.status).toBe(PaymentStatus.paid);
    expect(String(payment.amount)).toBe('850');
    expect(payment.razorpay_payment_id).toBe('pay_INTEG0001');

    // PROMO-02 — the redemption committed with the order it belongs to.
    const redemptions = await prisma.couponRedemption.findMany();
    expect(redemptions).toHaveLength(1);
    expect(redemptions[0].order_id).toBe(order.id);
    expect(String(redemptions[0].amount)).toBe('100');

    // LOYAL-02 — the spend, and the balance it left behind.
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({
      where: { customer_id: customer.customerId },
    });
    expect(account.points_balance).toBe(400);
    const ledger = await prisma.loyaltyTransaction.findMany();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].delta).toBe(-LOYALTY_POINTS);
    expect(ledger[0].balance_after).toBe(400);
    expect(ledger[0].order_id).toBe(order.id);

    // SPEC §3 — every mutating write in a transaction also writes AuditEvent.
    const audit = await prisma.auditEvent.findMany({
      orderBy: { created_at: 'asc' },
    });
    expect(audit.map((row) => row.action).sort()).toEqual([
      'coupon.redeemed',
      'order.confirmed',
    ]);
    const confirmed = audit.find((row) => row.action === 'order.confirmed');
    expect(confirmed?.entity_id).toBe(order.id);
    expect(confirmed?.actor_type).toBe(ActorType.customer);
    expect(confirmed?.actor_id).toBe(customer.customerId);
    expect(confirmed?.after).toMatchObject({
      total: '850',
      coupon_code: coupon.code,
      loyalty_points_redeemed: LOYALTY_POINTS,
    });
  });

  it('rolls the whole transaction back when the loyalty spend fails after the order and the coupon were written', async () => {
    await seedNode(prisma);
    const catalog = await seedCatalog(prisma);
    const customer = await seedCustomer(prisma, { points: 500 });
    const coupon = await seedCoupon(prisma);

    // The order row, the coupon redemption and the `coupon.redeemed` audit row
    // are all written *before* the loyalty spend runs. Asking for more points
    // than the account holds makes `LoyaltyService.redeem` throw at that point.
    await expect(
      services.fulfilment.confirmPaidOrder({
        customerId: customer.customerId,
        razorpayOrderId: 'order_INTEG0002',
        razorpayPaymentId: 'pay_INTEG0002',
        placedVia: OrderSource.storefront,
        pending: buildPending(catalog, customer, {
          coupon: { id: coupon.couponId, code: coupon.code },
          loyaltyPoints: 5_000,
          loyaltyAmount: LOYALTY_AMOUNT,
          razorpayOrderId: 'order_INTEG0002',
          idempotencyKey: 'idem-integ-0002',
        }),
      }),
    ).rejects.toThrow(BadRequestException);

    // Nothing survived — this is the assertion a mocked Prisma cannot make.
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.couponRedemption.count()).toBe(0);
    expect(await prisma.loyaltyTransaction.count()).toBe(0);
    expect(await prisma.auditEvent.count()).toBe(0);

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({
      where: { customer_id: customer.customerId },
    });
    expect(account.points_balance).toBe(500);
  });

  it('resolves a replayed payment to the existing order instead of spending the points twice', async () => {
    await seedNode(prisma);
    const catalog = await seedCatalog(prisma);
    const customer = await seedCustomer(prisma, { points: 500 });
    const coupon = await seedCoupon(prisma);

    const input = {
      customerId: customer.customerId,
      razorpayOrderId: 'order_INTEG0003',
      razorpayPaymentId: 'pay_INTEG0003',
      placedVia: OrderSource.storefront,
      pending: buildPending(catalog, customer, {
        coupon: { id: coupon.couponId, code: coupon.code },
        loyaltyPoints: LOYALTY_POINTS,
        loyaltyAmount: LOYALTY_AMOUNT,
        razorpayOrderId: 'order_INTEG0003',
        idempotencyKey: 'idem-integ-0003',
      }),
    };

    const first = await services.fulfilment.confirmPaidOrder(input);
    // The storefront confirm and the `payment.captured` webhook both run this
    // for the same capture. `Payment.razorpay_payment_id` is unique, so the
    // second attempt aborts on the index and falls through to the lookup.
    const replay = await services.fulfilment.confirmPaidOrder(input);

    expect(replay.id).toBe(first.id);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.payment.count()).toBe(1);
    expect(await prisma.couponRedemption.count()).toBe(1);
    expect(await prisma.loyaltyTransaction.count()).toBe(1);

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({
      where: { customer_id: customer.customerId },
    });
    expect(account.points_balance).toBe(400);
    // The replay is not a second confirmation, so it writes no second audit row.
    expect(
      await prisma.auditEvent.count({ where: { action: 'order.confirmed' } }),
    ).toBe(1);
  });

  it('serialises two concurrent confirms competing for the same loyalty balance', async () => {
    await seedNode(prisma);
    const catalog = await seedCatalog(prisma);
    // 100 points on the account, 60 wanted by each confirm: they cannot both win.
    const customer = await seedCustomer(prisma, { points: 100 });

    const confirm = (n: number) =>
      services.fulfilment.confirmPaidOrder({
        customerId: customer.customerId,
        razorpayOrderId: `order_INTEG000${n}`,
        razorpayPaymentId: `pay_INTEG000${n}`,
        placedVia: OrderSource.storefront,
        pending: buildPending(catalog, customer, {
          loyaltyPoints: 60,
          loyaltyAmount: 6_000,
          razorpayOrderId: `order_INTEG000${n}`,
          idempotencyKey: `idem-integ-000${n}`,
        }),
      });

    const settled = await Promise.allSettled([confirm(4), confirm(5)]);
    const fulfilled = settled.filter((r) => r.status === 'fulfilled');
    const rejected = settled.filter((r) => r.status === 'rejected');

    // Serializable + `withSerializableRetry`: the loser is either aborted by
    // Postgres (P2034) and re-runs against the committed balance, or reads it
    // directly — either way it finds 40 points left and refuses.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.payment.count()).toBe(1);
    expect(await prisma.loyaltyTransaction.count()).toBe(1);

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({
      where: { customer_id: customer.customerId },
    });
    // 100 − 60, never 100 − 120. The `LoyaltyAccount_balance_non_negative`
    // CHECK is the floor under this, and it was never reached.
    expect(account.points_balance).toBe(40);
    expect(
      await prisma.auditEvent.count({ where: { action: 'order.confirmed' } }),
    ).toBe(1);
  });
});
