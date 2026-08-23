import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActorType,
  LoyaltyReason,
  LoyaltyTier,
  type LoyaltyAccount,
  type LoyaltyTransaction,
} from '@prisma/client';
import type { Tx } from '../common/types/transaction';
import { PrismaService } from '../prisma/prisma.service';
import {
  SETTING_DEFAULTS,
  SettingsService,
} from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { hasPrismaCode } from '../common/utils/transaction-retry';
import {
  clampPaise,
  percentOfPaise,
  toPaise,
  type Paise,
} from '../common/money/money';

/** The `loyalty` block of `SystemSetting`, as `SettingsService.get` returns it. */
export type LoyaltyConfig = (typeof SETTING_DEFAULTS)['loyalty'];
type TierThresholds = LoyaltyConfig['tiers'];

/** ₹100 expressed in paise — the unit the earn rate is quoted against. */
const PAISE_PER_EARN_UNIT = 10_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** How many transactions the customer-facing ledger returns (API appendix). */
export const LOYALTY_LEDGER_PAGE = 50;

/** Ledger columns the storefront and the staff screen both read. */
const LEDGER_SELECT = {
  id: true,
  delta: true,
  balance_after: true,
  reason: true,
  order_id: true,
  notes: true,
  expires_at: true,
  created_at: true,
} as const;

export interface RedeemPreview {
  balance: number;
  tier: LoyaltyTier;
  max_redeemable_points: number;
  points_applied: number;
  /** Integer paise the applied points are worth — never more than the subtotal. */
  redeem_amount: Paise;
  redeem_value_per_point: number;
}

/**
 * LOYAL-01/LOYAL-02 — the single owner of `LoyaltyAccount` and `LoyaltyTransaction`.
 *
 * Three shapes of entry point, deliberately kept apart:
 *
 * - **`tx`-taking** (`earn`, `redeem`, `reverse`) run inside a caller's
 *   transaction — the checkout confirm (Task 10), the refund (Task 13) and the
 *   delivery transition (Task 15) all need the ledger write to commit or roll
 *   back with the order write it belongs to. They never open a transaction of
 *   their own and they never swallow an error the caller must see.
 * - **standalone** (`earnForOrder`, `adjust`) open their own transaction.
 * - **read-only** (`getAccount`, `getSummary`, `previewRedeem`, `earnEstimate`)
 *   touch no ledger row.
 *
 * Exactly-once is enforced by `@@unique([order_id, reason])`: at most one `earn`
 * and one `redeem` row can exist per order. Inside a caller's transaction a
 * duplicate would abort the *whole* transaction, so the `tx`-taking methods
 * pre-check with a `findUnique` and no-op; the unique index remains the
 * backstop, and the standalone path additionally maps `P2002` to `null`.
 */
@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ─── reads ────────────────────────────────────────────────────────────────

  /** The account, created empty (`member`, zero balance) on first read. */
  async getAccount(customerId: string): Promise<LoyaltyAccount> {
    return this.prisma.loyaltyAccount.upsert({
      where: { customer_id: customerId },
      create: { customer_id: customerId },
      update: {},
    });
  }

  /** `GET /customer/loyalty` — account, redemption rate, next tier and the ledger. */
  async getSummary(customerId: string) {
    const cfg = await this.settings.get('loyalty');
    const account = await this.getAccount(customerId);
    const transactions = await this.prisma.loyaltyTransaction.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      take: LOYALTY_LEDGER_PAGE,
      select: LEDGER_SELECT,
    });

    return {
      points_balance: account.points_balance,
      lifetime_points: account.lifetime_points,
      tier: account.tier,
      redeem_value_per_point: cfg.redeem_value_per_point,
      next_tier: this.nextTier(account.lifetime_points, cfg.tiers),
      transactions,
    };
  }

  /**
   * LOYAL-02 redemption preview for the quote. Points are whole; the rupee value
   * per point and the cap come from `SystemSetting['loyalty']`.
   *
   * Three ceilings apply at once — the balance, `max_redeem_percent` of the
   * subtotal, and the subtotal itself — so the returned `redeem_amount` can
   * never turn an order negative however the settings are edited.
   */
  async previewRedeem(
    customerId: string,
    requestedPoints: number,
    subtotal: Paise,
  ): Promise<RedeemPreview> {
    const cfg = await this.settings.get('loyalty');
    const account = await this.getAccount(customerId);
    const valuePerPoint = toPaise(cfg.redeem_value_per_point); // 0.25 -> 25 paise
    const capPaise = percentOfPaise(subtotal, cfg.max_redeem_percent);
    const maxPointsByCap =
      valuePerPoint > 0 ? Math.floor(capPaise / valuePerPoint) : 0;
    const maxPoints = Math.max(
      0,
      Math.min(account.points_balance, maxPointsByCap),
    );
    const requested = Number.isFinite(requestedPoints)
      ? Math.floor(requestedPoints)
      : 0;
    const points = Math.max(0, Math.min(requested, maxPoints));

    return {
      balance: account.points_balance,
      tier: account.tier,
      max_redeemable_points: maxPoints,
      points_applied: points,
      redeem_amount: clampPaise(points * valuePerPoint, 0, subtotal),
      redeem_value_per_point: cfg.redeem_value_per_point,
    };
  }

  /** Points a paid order will earn once it is delivered/attended. */
  async earnEstimate(netPaise: Paise): Promise<number> {
    const cfg = await this.settings.get('loyalty');
    return this.pointsFor(netPaise, cfg.earn_rate_per_100);
  }

  // ─── ledger writes inside a caller's transaction ──────────────────────────

  /**
   * LOYAL-02 earn, fired on `order.delivered` / `booking.attended`.
   * `tx` MUST be the caller's transaction client.
   *
   * Returns `null` when the order earns nothing *or* has already earned — both
   * are the same no-op to the caller, and neither is an error.
   */
  async earn(
    tx: Tx,
    customerId: string,
    orderId: string,
    netPaise: Paise,
  ): Promise<LoyaltyTransaction | null> {
    const cfg = await this.settings.get('loyalty');
    const points = this.pointsFor(netPaise, cfg.earn_rate_per_100);
    if (points <= 0) return null;
    if (await this.alreadyWritten(tx, orderId, LoyaltyReason.earn)) return null;

    const account = await this.upsertAccount(tx, customerId);
    const balanceAfter = account.points_balance + points;
    const lifetime = account.lifetime_points + points;

    await tx.loyaltyAccount.update({
      where: { customer_id: customerId },
      data: {
        points_balance: balanceAfter,
        lifetime_points: lifetime,
        tier: this.tierFor(lifetime, cfg.tiers),
      },
    });

    return tx.loyaltyTransaction.create({
      data: {
        customer_id: customerId,
        order_id: orderId,
        delta: points,
        balance_after: balanceAfter,
        reason: LoyaltyReason.earn,
        expires_at: new Date(Date.now() + cfg.expiry_days * MS_PER_DAY),
      },
    });
  }

  /**
   * LOYAL-02 redemption, applied inside the confirm transaction so the points
   * and the order they paid for commit together.
   * `tx` MUST be the caller's transaction client.
   */
  async redeem(
    tx: Tx,
    customerId: string,
    orderId: string,
    points: number,
  ): Promise<LoyaltyTransaction | null> {
    if (points <= 0) return null;
    if (!Number.isSafeInteger(points)) {
      throw new BadRequestException('Loyalty points must be a whole number');
    }
    if (await this.alreadyWritten(tx, orderId, LoyaltyReason.redeem)) {
      return null;
    }

    const account = await this.upsertAccount(tx, customerId);
    if (account.points_balance < points) {
      throw new BadRequestException('Not enough loyalty points');
    }
    const balanceAfter = account.points_balance - points;

    await tx.loyaltyAccount.update({
      where: { customer_id: customerId },
      data: { points_balance: balanceAfter },
    });

    return tx.loyaltyTransaction.create({
      data: {
        customer_id: customerId,
        order_id: orderId,
        delta: -points,
        balance_after: balanceAfter,
        reason: LoyaltyReason.redeem,
      },
    });
  }

  /**
   * Plan-named alias kept for the confirm path (Task 10) — `redeem` with the
   * argument order the fulfilment service was specified against.
   */
  async redeemForOrder(
    tx: Tx,
    customerId: string,
    orderId: string,
    points: number,
  ): Promise<LoyaltyTransaction | null> {
    return this.redeem(tx, customerId, orderId, points);
  }

  /**
   * Undoes an order's loyalty effects when it is refunded or cancelled
   * (Task 13). `tx` MUST be the caller's transaction client.
   *
   * One compensating row, not two: the net of the order's existing `earn` and
   * `redeem` deltas is written back as a single `adjust` row keyed to the same
   * order, so `@@unique([order_id, reason])` makes a replayed refund a no-op.
   * Any `earn` row is flagged `expired` so the nightly job cannot deduct points
   * that have already been clawed back.
   *
   * The balance floor is zero: if the earned points were already spent, the
   * clawback takes what is left and the recorded `delta` is the amount actually
   * applied, so `balance_after` always equals the row's own arithmetic.
   */
  async reverse(
    tx: Tx,
    customerId: string,
    orderId: string,
    notes = 'Reversed on refund',
  ): Promise<LoyaltyTransaction | null> {
    if (await this.alreadyWritten(tx, orderId, LoyaltyReason.adjust)) {
      return null;
    }

    const rows = await tx.loyaltyTransaction.findMany({
      where: {
        order_id: orderId,
        reason: { in: [LoyaltyReason.earn, LoyaltyReason.redeem] },
      },
      select: { id: true, delta: true, reason: true },
    });
    if (rows.length === 0) return null;

    const net = rows.reduce((sum, row) => sum + row.delta, 0);
    const earned = rows
      .filter((row) => row.reason === LoyaltyReason.earn)
      .reduce((sum, row) => sum + row.delta, 0);
    if (net === 0 && earned === 0) return null;

    const cfg = await this.settings.get('loyalty');
    const account = await this.upsertAccount(tx, customerId);
    // Never below zero: the earned points may already have been spent.
    const applied = Math.max(-net, -account.points_balance);
    const balanceAfter = account.points_balance + applied;
    const lifetime = Math.max(0, account.lifetime_points - earned);

    await tx.loyaltyAccount.update({
      where: { customer_id: customerId },
      data: {
        points_balance: balanceAfter,
        lifetime_points: lifetime,
        tier: this.tierFor(lifetime, cfg.tiers),
      },
    });

    const earnRow = rows.find((row) => row.reason === LoyaltyReason.earn);
    if (earnRow) {
      await tx.loyaltyTransaction.update({
        where: { id: earnRow.id },
        data: { expired: true },
      });
    }

    return tx.loyaltyTransaction.create({
      data: {
        customer_id: customerId,
        order_id: orderId,
        delta: applied,
        balance_after: balanceAfter,
        reason: LoyaltyReason.adjust,
        notes,
      },
    });
  }

  // ─── standalone writes ────────────────────────────────────────────────────

  /**
   * LOYAL-02 earn for callers that own no transaction (the delivery listener and
   * the shipment webhook). Idempotent twice over: `earn` pre-checks the ledger,
   * and a `P2002` from a racing replay is mapped to `null` rather than thrown.
   */
  async earnForOrder(
    orderId: string,
    customerId: string,
    netPaise: Paise,
  ): Promise<LoyaltyTransaction | null> {
    try {
      return await this.prisma.$transaction((tx) =>
        this.earn(tx, customerId, orderId, netPaise),
      );
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) return null; // already earned for this order
      throw err;
    }
  }

  /**
   * LOYAL-01 staff adjustment — always audited. `order_id` stays `null`, which
   * Postgres treats as distinct under `@@unique([order_id, reason])`, so a
   * customer may be adjusted any number of times.
   *
   * A positive delta counts toward `lifetime_points` (and can promote a tier);
   * a negative one claws the same amount back off it, so a mistaken credit that
   * is corrected does not leave the tier inflated.
   */
  async adjust(
    customerId: string,
    delta: number,
    notes: string,
    userId: string | null,
  ) {
    if (!Number.isSafeInteger(delta) || delta === 0) {
      throw new BadRequestException(
        'Loyalty adjustment must be a non-zero whole number of points',
      );
    }
    const cfg = await this.settings.get('loyalty');

    return this.prisma.$transaction(async (tx) => {
      const account = await this.upsertAccount(tx, customerId);
      const balanceAfter = account.points_balance + delta;
      if (balanceAfter < 0) {
        throw new BadRequestException(
          `Adjustment of ${delta} would take the balance below zero (current ${account.points_balance})`,
        );
      }
      const lifetime = Math.max(0, account.lifetime_points + delta);
      const tier = this.tierFor(lifetime, cfg.tiers);

      const updated = await tx.loyaltyAccount.update({
        where: { customer_id: customerId },
        data: {
          points_balance: balanceAfter,
          lifetime_points: lifetime,
          tier,
        },
      });

      const row = await tx.loyaltyTransaction.create({
        data: {
          customer_id: customerId,
          order_id: null,
          delta,
          balance_after: balanceAfter,
          reason: LoyaltyReason.adjust,
          notes,
          created_by: userId,
        },
      });

      await this.audit.record(tx, {
        entity_type: 'LoyaltyAccount',
        entity_id: customerId,
        action: 'loyalty.adjusted',
        ...(userId
          ? { actor_type: ActorType.user, actor_id: userId }
          : { actor_type: ActorType.system, actor_id: null }),
        before: {
          points_balance: account.points_balance,
          lifetime_points: account.lifetime_points,
          tier: account.tier,
        },
        after: {
          points_balance: balanceAfter,
          lifetime_points: lifetime,
          tier,
          delta,
          notes,
          transaction_id: row.id,
        },
      });

      return updated;
    });
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  /** `floor(net ÷ ₹100) × earn_rate_per_100`; a non-positive net earns nothing. */
  private pointsFor(netPaise: Paise, ratePer100: number): number {
    if (!Number.isFinite(netPaise) || netPaise <= 0) return 0;
    return Math.floor(netPaise / PAISE_PER_EARN_UNIT) * ratePer100;
  }

  /** The `@@unique([order_id, reason])` pre-check the `tx`-taking methods share. */
  private async alreadyWritten(
    tx: Tx,
    orderId: string,
    reason: LoyaltyReason,
  ): Promise<boolean> {
    const existing = await tx.loyaltyTransaction.findUnique({
      where: { order_id_reason: { order_id: orderId, reason } },
      select: { id: true },
    });
    return existing !== null;
  }

  private async upsertAccount(
    tx: Tx,
    customerId: string,
  ): Promise<LoyaltyAccount> {
    return tx.loyaltyAccount.upsert({
      where: { customer_id: customerId },
      create: { customer_id: customerId },
      update: {},
    });
  }

  /** Tier from lifetime points — highest threshold reached wins. */
  private tierFor(lifetime: number, tiers: TierThresholds): LoyaltyTier {
    if (lifetime >= tiers.insider) return LoyaltyTier.insider;
    if (lifetime >= tiers.regular) return LoyaltyTier.regular;
    return LoyaltyTier.member;
  }

  /** `null` once the top tier is reached — there is nothing left to work toward. */
  private nextTier(
    lifetime: number,
    tiers: TierThresholds,
  ): { tier: LoyaltyTier; points_needed: number } | null {
    if (lifetime < tiers.regular) {
      return {
        tier: LoyaltyTier.regular,
        points_needed: tiers.regular - lifetime,
      };
    }
    if (lifetime < tiers.insider) {
      return {
        tier: LoyaltyTier.insider,
        points_needed: tiers.insider - lifetime,
      };
    }
    return null;
  }
}
