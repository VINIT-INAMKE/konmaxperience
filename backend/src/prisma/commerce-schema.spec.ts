import {
  CouponStatus,
  LoyaltyReason,
  PrismaClient,
  RefundStatus,
  ShipmentStatus,
} from '@prisma/client';

describe('P5a commerce schema', () => {
  const client = new PrismaClient() as unknown as Record<string, unknown>;

  it.each([
    'shipment',
    'shipmentEvent',
    'refund',
    'coupon',
    'couponRedemption',
    'loyaltyAccount',
    'loyaltyTransaction',
    'review',
  ])('exposes the %s delegate', (delegate) => {
    expect(client[delegate]).toBeDefined();
  });

  it('declares the new enums', () => {
    expect(Object.values(RefundStatus)).toEqual([
      'pending',
      'processed',
      'failed',
    ]);
    expect(Object.values(CouponStatus)).toEqual([
      'draft',
      'active',
      'disabled',
    ]);
  });

  it('keeps the P2-declared commerce enums intact', () => {
    expect(Object.values(ShipmentStatus)).toContain('out_for_delivery');
    expect(Object.values(LoyaltyReason)).toEqual([
      'earn',
      'redeem',
      'adjust',
      'expire',
    ]);
  });

  afterAll(async () => {
    await (client as unknown as PrismaClient).$disconnect();
  });
});
