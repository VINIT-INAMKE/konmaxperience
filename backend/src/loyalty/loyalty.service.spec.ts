import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ActorType, LoyaltyReason, LoyaltyTier } from '@prisma/client';
import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import {
  mockPrisma,
  mockSettings,
  type MockPrisma,
} from '../test-utils/mock-providers';

const CUSTOMER = 'c0000000-0000-4000-8000-000000000001';
const ORDER = '00000000-0000-4000-8000-0000000000aa';
const USER = 'u0000000-0000-4000-8000-000000000001';

/** `2026-08-24T00:00:00Z` + 365 days. */
const NOW = new Date('2026-08-24T00:00:00.000Z');

function account(overrides: Record<string, unknown> = {}) {
  return {
    customer_id: CUSTOMER,
    points_balance: 0,
    lifetime_points: 0,
    tier: LoyaltyTier.member,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let prisma: MockPrisma;
  let settings: ReturnType<typeof mockSettings>;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = mockPrisma();
    settings = mockSettings();
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    // Default happy-path stubs; individual tests override.
    prisma.loyaltyAccount.upsert.mockResolvedValue(account());
    prisma.loyaltyAccount.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(account(data)),
    );
    prisma.loyaltyAccount.findUnique.mockResolvedValue(account());
    prisma.loyaltyTransaction.findUnique.mockResolvedValue(null);
    prisma.loyaltyTransaction.findMany.mockResolvedValue([]);
    prisma.loyaltyTransaction.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'txn-1', ...data }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── getAccount ─────────────────────────────────────────────────────────

  describe('getAccount', () => {
    it('creates a zero-balance member account on first read', async () => {
      const result = await service.getAccount(CUSTOMER);

      expect(prisma.loyaltyAccount.upsert).toHaveBeenCalledWith({
        where: { customer_id: CUSTOMER },
        create: { customer_id: CUSTOMER },
        update: {},
      });
      expect(result.points_balance).toBe(0);
      expect(result.tier).toBe(LoyaltyTier.member);
    });
  });

  // ─── getSummary ─────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns the balance, rate, next tier and the last 50 rows', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({
          points_balance: 620,
          lifetime_points: 620,
          tier: LoyaltyTier.regular,
        }),
      );
      prisma.loyaltyTransaction.findMany.mockResolvedValue([{ id: 'txn-1' }]);

      const result = await service.getSummary(CUSTOMER);

      expect(result).toMatchObject({
        points_balance: 620,
        lifetime_points: 620,
        tier: LoyaltyTier.regular,
        redeem_value_per_point: 0.25,
        next_tier: { tier: LoyaltyTier.insider, points_needed: 1380 },
      });
      expect(result.transactions).toHaveLength(1);
      expect(prisma.loyaltyTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customer_id: CUSTOMER },
          take: 50,
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    it('reports no next tier once insider is reached', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({
          points_balance: 10,
          lifetime_points: 2400,
          tier: LoyaltyTier.insider,
        }),
      );

      const result = await service.getSummary(CUSTOMER);

      expect(result.next_tier).toBeNull();
    });
  });

  // ─── previewRedeem ──────────────────────────────────────────────────────

  describe('previewRedeem', () => {
    /** 20% of ₹1000 is ₹200 = 800 points at ₹0.25 each. */
    const SUBTOTAL = 100_000;

    it('caps at max_redeem_percent of the subtotal', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 5000 }),
      );

      const result = await service.previewRedeem(CUSTOMER, 5000, SUBTOTAL);

      expect(result.max_redeemable_points).toBe(800);
      expect(result.points_applied).toBe(800);
      expect(result.redeem_amount).toBe(20_000); // ₹200 in paise
    });

    it('caps at the balance when the balance is the tighter limit', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 120, tier: LoyaltyTier.member }),
      );

      const result = await service.previewRedeem(CUSTOMER, 500, SUBTOTAL);

      expect(result.max_redeemable_points).toBe(120);
      expect(result.points_applied).toBe(120);
      expect(result.redeem_amount).toBe(3_000); // 120 × 25 paise
    });

    it('floors a fractional request to whole points and never goes negative', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 5000 }),
      );

      const fractional = await service.previewRedeem(CUSTOMER, 10.9, SUBTOTAL);
      expect(fractional.points_applied).toBe(10);

      const negative = await service.previewRedeem(CUSTOMER, -50, SUBTOTAL);
      expect(negative.points_applied).toBe(0);
      expect(negative.redeem_amount).toBe(0);
    });

    it('applies nothing on a zero subtotal', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 5000 }),
      );

      const result = await service.previewRedeem(CUSTOMER, 100, 0);

      expect(result.max_redeemable_points).toBe(0);
      expect(result.points_applied).toBe(0);
      expect(result.redeem_amount).toBe(0);
    });
  });

  // ─── earnEstimate ───────────────────────────────────────────────────────

  describe('earnEstimate', () => {
    it('is floor(net ÷ ₹100) × earn_rate_per_100', async () => {
      await expect(service.earnEstimate(64_999)).resolves.toBe(30); // ₹649.99 -> 6 × 5
      await expect(service.earnEstimate(9_999)).resolves.toBe(0);
      await expect(service.earnEstimate(0)).resolves.toBe(0);
    });
  });

  // ─── earn ───────────────────────────────────────────────────────────────

  describe('earn / earnForOrder', () => {
    it('writes delta = floor(net ÷ ₹100) × rate with expires_at = now + expiry_days', async () => {
      jest.useFakeTimers().setSystemTime(NOW);

      await service.earnForOrder(ORDER, CUSTOMER, 64_999);

      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledTimes(1);
      const args = prisma.loyaltyTransaction.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(args.data).toMatchObject({
        customer_id: CUSTOMER,
        order_id: ORDER,
        delta: 30,
        balance_after: 30,
        reason: LoyaltyReason.earn,
      });
      expect((args.data.expires_at as Date).toISOString()).toBe(
        '2027-08-24T00:00:00.000Z',
      );
    });

    it('promotes the tier from lifetime_points', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 480, lifetime_points: 480 }),
      );

      await service.earnForOrder(ORDER, CUSTOMER, 400_000); // ₹4000 -> 200 points

      expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { customer_id: CUSTOMER },
        data: {
          points_balance: 680,
          lifetime_points: 680,
          tier: LoyaltyTier.regular,
        },
      });
    });

    it('reaches insider at the seeded 2000-point threshold', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({
          points_balance: 1900,
          lifetime_points: 1900,
          tier: LoyaltyTier.regular,
        }),
      );

      await service.earnForOrder(ORDER, CUSTOMER, 200_000); // ₹2000 -> 100 points

      expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lifetime_points: 2000,
            tier: LoyaltyTier.insider,
          }),
        }),
      );
    });

    it('is a no-op the second time the same order is credited', async () => {
      prisma.loyaltyTransaction.findUnique.mockResolvedValue({ id: 'txn-1' });

      const result = await service.earnForOrder(ORDER, CUSTOMER, 64_999);

      expect(result).toBeNull();
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
      expect(prisma.loyaltyAccount.update).not.toHaveBeenCalled();
    });

    it('maps a racing P2002 on (order_id, reason) to null', async () => {
      prisma.loyaltyTransaction.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.earnForOrder(ORDER, CUSTOMER, 64_999),
      ).resolves.toBeNull();
    });

    it('rethrows a non-P2002 failure', async () => {
      prisma.loyaltyTransaction.create.mockRejectedValue({ code: 'P2003' });

      await expect(
        service.earnForOrder(ORDER, CUSTOMER, 64_999),
      ).rejects.toEqual({ code: 'P2003' });
    });

    it('earns nothing below ₹100 net', async () => {
      const result = await service.earnForOrder(ORDER, CUSTOMER, 9_999);

      expect(result).toBeNull();
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    });

    it('uses the caller transaction client, not prisma, when given one', async () => {
      const tx = mockPrisma();
      tx.loyaltyAccount.upsert.mockResolvedValue(account());
      tx.loyaltyTransaction.findUnique.mockResolvedValue(null);
      tx.loyaltyTransaction.create.mockResolvedValue({ id: 'txn-1' });

      await service.earn(tx as any, CUSTOMER, ORDER, 64_999);

      expect(tx.loyaltyTransaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    });
  });

  // ─── redeem ─────────────────────────────────────────────────────────────

  describe('redeem / redeemForOrder', () => {
    it('decrements the balance and records balance_after', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 620, lifetime_points: 620 }),
      );

      await service.redeemForOrder(prisma as any, CUSTOMER, ORDER, 100);

      expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { customer_id: CUSTOMER },
        data: { points_balance: 520 },
      });
      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: {
          customer_id: CUSTOMER,
          order_id: ORDER,
          delta: -100,
          balance_after: 520,
          reason: LoyaltyReason.redeem,
        },
      });
    });

    it('leaves lifetime_points alone — redemption does not un-earn', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({
          points_balance: 620,
          lifetime_points: 620,
          tier: LoyaltyTier.regular,
        }),
      );

      await service.redeem(prisma as any, CUSTOMER, ORDER, 600);

      const data = (
        prisma.loyaltyAccount.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data;
      expect(data).not.toHaveProperty('lifetime_points');
      expect(data).not.toHaveProperty('tier');
    });

    it('throws when the redemption is larger than the balance', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 50 }),
      );

      await expect(
        service.redeem(prisma as any, CUSTOMER, ORDER, 100),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    });

    it('is a no-op for zero points and for a replayed order', async () => {
      await expect(
        service.redeem(prisma as any, CUSTOMER, ORDER, 0),
      ).resolves.toBeNull();

      prisma.loyaltyTransaction.findUnique.mockResolvedValue({ id: 'txn-1' });
      await expect(
        service.redeem(prisma as any, CUSTOMER, ORDER, 100),
      ).resolves.toBeNull();
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    });
  });

  // ─── reverse ────────────────────────────────────────────────────────────

  describe('reverse', () => {
    it('writes one compensating adjust row for the order net', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({
          points_balance: 520,
          lifetime_points: 620,
          tier: LoyaltyTier.regular,
        }),
      );
      prisma.loyaltyTransaction.findMany.mockResolvedValue([
        { id: 'earn-1', delta: 30, reason: LoyaltyReason.earn },
        { id: 'redeem-1', delta: -100, reason: LoyaltyReason.redeem },
      ]);

      await service.reverse(prisma as any, CUSTOMER, ORDER);

      // net = -70, so the reversal credits 70 back.
      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: {
          customer_id: CUSTOMER,
          order_id: ORDER,
          delta: 70,
          balance_after: 590,
          reason: LoyaltyReason.adjust,
          notes: 'Reversed on refund',
        },
      });
      // lifetime loses only the earned 30, so the tier is recomputed from 590.
      expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { customer_id: CUSTOMER },
        data: {
          points_balance: 590,
          lifetime_points: 590,
          tier: LoyaltyTier.regular,
        },
      });
    });

    it('flags the earn row expired so the nightly job cannot deduct it again', async () => {
      prisma.loyaltyTransaction.findMany.mockResolvedValue([
        { id: 'earn-1', delta: 30, reason: LoyaltyReason.earn },
      ]);
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 30, lifetime_points: 30 }),
      );

      await service.reverse(prisma as any, CUSTOMER, ORDER);

      expect(prisma.loyaltyTransaction.update).toHaveBeenCalledWith({
        where: { id: 'earn-1' },
        data: { expired: true },
      });
    });

    it('never drives the balance below zero when the points were already spent', async () => {
      prisma.loyaltyTransaction.findMany.mockResolvedValue([
        { id: 'earn-1', delta: 100, reason: LoyaltyReason.earn },
      ]);
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 40, lifetime_points: 100 }),
      );

      await service.reverse(prisma as any, CUSTOMER, ORDER);

      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ delta: -40, balance_after: 0 }),
        }),
      );
    });

    it('is a no-op when the order was already reversed or never touched loyalty', async () => {
      prisma.loyaltyTransaction.findUnique.mockResolvedValue({ id: 'adj-1' });
      await expect(
        service.reverse(prisma as any, CUSTOMER, ORDER),
      ).resolves.toBeNull();

      prisma.loyaltyTransaction.findUnique.mockResolvedValue(null);
      prisma.loyaltyTransaction.findMany.mockResolvedValue([]);
      await expect(
        service.reverse(prisma as any, CUSTOMER, ORDER),
      ).resolves.toBeNull();
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    });
  });

  // ─── adjust ─────────────────────────────────────────────────────────────

  describe('adjust', () => {
    it('writes a LoyaltyTransaction(adjust) and an AuditEvent', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 620, lifetime_points: 620 }),
      );

      await service.adjust(CUSTOMER, -50, 'Goodwill correction', USER);

      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: {
          customer_id: CUSTOMER,
          order_id: null,
          delta: -50,
          balance_after: 570,
          reason: LoyaltyReason.adjust,
          notes: 'Goodwill correction',
          created_by: USER,
        },
      });
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entity_type: 'LoyaltyAccount',
          entity_id: CUSTOMER,
          action: 'loyalty.adjusted',
          actor_type: ActorType.user,
          actor_id: USER,
        }),
      );
    });

    it('recomputes the tier from the adjusted lifetime total', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 100, lifetime_points: 450 }),
      );

      await service.adjust(CUSTOMER, 100, 'Launch bonus', USER);

      expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { customer_id: CUSTOMER },
        data: {
          points_balance: 200,
          lifetime_points: 550,
          tier: LoyaltyTier.regular,
        },
      });
    });

    it('refuses an adjustment that would take the balance below zero', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 10, lifetime_points: 10 }),
      );

      await expect(
        service.adjust(CUSTOMER, -50, 'Too big', USER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('refuses a zero or fractional adjustment', async () => {
      await expect(
        service.adjust(CUSTOMER, 0, 'Nothing', USER),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.adjust(CUSTOMER, 1.5, 'Fractional', USER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('records a system actor when no staff user is present', async () => {
      prisma.loyaltyAccount.upsert.mockResolvedValue(
        account({ points_balance: 100, lifetime_points: 100 }),
      );

      await service.adjust(CUSTOMER, 10, 'Backfill', null);

      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          actor_type: ActorType.system,
          actor_id: null,
        }),
      );
    });
  });
});
