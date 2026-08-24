import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DailyClose,
  DailyCloseStatus,
  OrderChannel,
  OrderStatus,
  PrepBatchStatus,
  Prisma,
  RefundStatus,
  ShipmentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { NodeService } from '../node/node.service';
import { nodeDayKey, nodeDayRange } from '../common/utils/node-time';
import { toPaise } from '../common/money/money';

/**
 * Bumped whenever a field in {@link DailyCloseMetrics} changes meaning.
 *
 * A signed close is frozen for good (decision 16), so rows written under an
 * older version survive forever — the renderer branches on this, it never
 * guesses from which keys happen to be present.
 */
export const DAILY_CLOSE_METRICS_VERSION = 1;

/** `YYYY-MM-DD`. The only date shape this module accepts on the wire. */
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Orders in these states are counted separately and excluded from revenue:
 * a cancelled order never happened, and a refunded one is reported as its own
 * line rather than silently netted out of the day's takings.
 */
export const CLOSED_OUT_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.cancelled,
  OrderStatus.refunded,
];

/** Everything between "created" and a terminal outcome — still someone's problem. */
export const OPEN_SHIPMENT_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.pending,
  ShipmentStatus.awb_assigned,
  ShipmentStatus.pickup_scheduled,
  ShipmentStatus.picked_up,
  ShipmentStatus.in_transit,
  ShipmentStatus.out_for_delivery,
];

/** A parcel that will not arrive without human action. `rto` is a failure with a return leg. */
export const FAILED_SHIPMENT_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.failed,
  ShipmentStatus.rto,
];

/** The action `StockReconciliationCron` writes for every drifted stock row. */
export const RECONCILIATION_MISMATCH_ACTION = 'stock.reconciliation_mismatch';

/** `entity_type` on the sign-off audit row. */
export const DAILY_CLOSE_ENTITY_TYPE = 'daily_close';

/** `action` on the sign-off audit row. */
export const DAILY_CLOSE_SIGNED_ACTION = 'daily_close.signed';

/** Revenue for one sales channel on the closed day. */
export interface DailyCloseChannelBreakdown {
  channel: OrderChannel;
  orders: number;
  revenue_paise: number;
}

/**
 * The order half of the close. Every money field is **integer paise**
 * (`common/money/money.ts`) — a signed artefact must not carry a float, and
 * `Number(Decimal)` on a rupee sum is exactly that.
 */
export interface DailyCloseOrderMetrics {
  /** Orders counted in `revenue_paise` — i.e. excluding cancelled and refunded. */
  total: number;
  /**
   * Σ `Order.total` over the counted orders. Tax-inclusive (P5a decision 1):
   * `total = subtotal − discount + shipping` on the storefront path,
   * `subtotal + channel_modifier` on the POS path, with GST carved out of it.
   * This is the authoritative figure; the components below exist so an auditor
   * can reconcile it, and are never used to re-derive it.
   */
  revenue_paise: number;
  subtotal_paise: number;
  channel_modifier_paise: number;
  discount_paise: number;
  shipping_paise: number;
  /** GST already carved out of `revenue_paise`, not added on top of it. */
  tax_paise: number;
  /** `revenue_paise − tax_paise` — what the node keeps before cost. */
  net_revenue_paise: number;
  by_channel: DailyCloseChannelBreakdown[];
  cancelled: number;
  refunded: number;
  /** `Refund` rows that reached `processed` on this day. */
  refunds: number;
  refund_amount_paise: number;
}

/** One waste reason and what it cost. */
export interface DailyCloseWasteReason {
  reason: string;
  entries: number;
  cost_paise: number;
}

/**
 * The frozen contract rendered by the daily-close screen and read by the
 * morning brief. Persisted verbatim in `DailyClose.metrics`.
 */
export interface DailyCloseMetrics {
  version: number;
  /** `YYYY-MM-DD`, node-local. */
  business_date: string;
  /** IANA zone the day was bounded in, recorded so a re-zoned node stays readable. */
  timezone: string;
  /** ISO-4217 code from `Node.currency`. */
  currency: string;
  /** The UTC instants the day spanned, `[start, end)`. */
  window: { start: string; end: string };
  orders: DailyCloseOrderMetrics;
  waste: {
    entries: number;
    cost_paise: number;
    by_reason: DailyCloseWasteReason[];
  };
  batches: { created: number; depleted: number };
  /**
   * `checked` is the current `IngredientStock` row count; `drifted` counts the
   * mismatch audit rows written inside the window. `ran_at` is the newest of
   * those rows — **null on a clean night**, because the reconciliation cron
   * records drift and nothing else (that is deliberate: see its doc comment).
   */
  stock_reconciliation: {
    checked: number;
    drifted: number;
    ran_at: string | null;
  };
  /** Shipments *created* on this day, folded by outcome. `cancelled` is in none of the first three. */
  shipments: {
    open: number;
    failed: number;
    delivered: number;
    cancelled: number;
  };
  /** ISO instant the numbers were gathered — a recompute moves it, a signature freezes it. */
  computed_at: string;
}

/** A `DailyClose` row with `business_date` rendered as the `YYYY-MM-DD` the API speaks. */
export interface DailyCloseView extends Omit<DailyClose, 'business_date'> {
  business_date: string;
}

/** `YYYY-MM-DD` → the UTC-midnight `Date` a `@db.Date` column round-trips. */
export function dayKeyToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** The inverse of {@link dayKeyToDate}, for a value read back out of `@db.Date`. */
export function dateToDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Rejects anything that is not a real `YYYY-MM-DD` calendar day.
 *
 * The regex alone would accept `2026-02-31` (which `Date` silently rolls over to
 * March 3rd) and `2026-13-01` (which it rejects outright as an invalid time
 * value), so the round-trip through `Date` is the actual check — a bad day key
 * must be a 400 here, never a 500 from Postgres or a close filed under the wrong
 * date.
 */
export function assertBusinessDateKey(value: string): string {
  const parsed =
    typeof value === 'string' && BUSINESS_DATE_PATTERN.test(value)
      ? dayKeyToDate(value)
      : null;

  if (
    !parsed ||
    Number.isNaN(parsed.getTime()) ||
    dateToDayKey(parsed) !== value
  ) {
    throw new BadRequestException(
      `business_date must be a calendar date in YYYY-MM-DD form, received "${String(value)}"`,
    );
  }
  return value;
}

/** Rows out of the database carry a `Date`; the API and the screen speak day keys. */
export function present(close: DailyClose): DailyCloseView {
  return { ...close, business_date: dateToDayKey(close.business_date) };
}

/** `Decimal | null` from a Prisma `_sum` → integer paise. */
function sumToPaise(value: Prisma.Decimal | null): number {
  return toPaise(value ?? 0);
}

/**
 * RUN-02 — the daily close.
 *
 * A close is a **persisted, signed artefact, not a live query** (decision 16).
 * A cron computes and upserts yesterday as `open`; the screen renders
 * `DailyClose.metrics` verbatim; a signatory flips it to `signed`, which writes
 * an `AuditEvent` in the same transaction and freezes the numbers for good.
 * Recomputing on read would let a late refund change a figure somebody already
 * put their name to — the exact failure a close exists to prevent.
 */
@Injectable()
export class DailyCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly node: NodeService,
  ) {}

  /** Today's node-local day key — what the cron shifts back by one. */
  async today(now: Date = new Date()): Promise<string> {
    return nodeDayKey(await this.node.timezone(), now);
  }

  /**
   * Computes the metrics for one node-local business day and upserts the row as
   * `open`. Idempotent: re-running before sign-off refreshes the numbers,
   * re-running after sign-off is a **no-op** — a signed close is frozen, which
   * is the whole reason the metrics live in a column.
   */
  async computeAndUpsert(businessDate: string): Promise<DailyClose> {
    const day = assertBusinessDateKey(businessDate);
    const node = await this.node.current();
    const date = dayKeyToDate(day);
    const key = { node_id: node.id, business_date: date };

    const existing = await this.prisma.dailyClose.findUnique({
      where: { node_id_business_date: key },
    });
    if (existing?.status === DailyCloseStatus.signed) return existing;

    const metrics = await this.gather(node, day);
    const json = metrics as unknown as Prisma.InputJsonValue;

    return this.prisma.dailyClose.upsert({
      where: { node_id_business_date: key },
      create: { ...key, metrics: json },
      update: { metrics: json },
    });
  }

  /**
   * RUN-02 sign-off. Two gates, both required: `MANAGE_OPS` at the controller,
   * and membership of `SystemSetting['daily_close'].signer_role_codes` here —
   * the permission says "may run operations", the setting says "is accountable
   * for the day", and SPEC names the second, not the first.
   */
  async sign(
    businessDate: string,
    userId: string,
    notes: string | null,
  ): Promise<DailyClose> {
    const day = assertBusinessDateKey(businessDate);
    const cfg = await this.settings.get('daily_close');
    const node = await this.node.current();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { code: true } } },
    });
    if (!user || !cfg.signer_role_codes.includes(user.role.code)) {
      throw new ForbiddenException(
        `Only ${cfg.signer_role_codes.join(' or ')} may sign the daily close`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const close = await tx.dailyClose.findUnique({
        where: {
          node_id_business_date: {
            node_id: node.id,
            business_date: dayKeyToDate(day),
          },
        },
      });
      if (!close) {
        throw new NotFoundException(`No daily close computed for ${day}`);
      }
      if (close.status === DailyCloseStatus.signed) {
        throw new ConflictException('This day is already signed');
      }

      const signed = await tx.dailyClose.update({
        where: { id: close.id },
        data: {
          status: DailyCloseStatus.signed,
          signed_by: userId,
          signed_at: new Date(),
          notes,
        },
      });

      // RUN-02 says the sign-off *is* an AuditEvent. In the same transaction,
      // carrying the frozen metrics, so the audit row is self-contained even if
      // the DailyClose row is later archived.
      await this.audit.record(tx, {
        entity_type: DAILY_CLOSE_ENTITY_TYPE,
        entity_id: signed.id,
        action: DAILY_CLOSE_SIGNED_ACTION,
        node_id: node.id,
        ...AuditService.user(userId),
        before: { status: close.status },
        after: {
          status: signed.status,
          business_date: day,
          notes,
          metrics: signed.metrics as Prisma.InputJsonValue,
        },
      });

      return signed;
    });
  }

  /** `GET /daily-close?from=&to=&limit=` — newest business day first. */
  async list(params: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<DailyClose[]> {
    const node = await this.node.current();
    const where: Prisma.DailyCloseWhereInput = { node_id: node.id };

    if (params.from || params.to) {
      where.business_date = {
        ...(params.from
          ? { gte: dayKeyToDate(assertBusinessDateKey(params.from)) }
          : {}),
        ...(params.to
          ? { lte: dayKeyToDate(assertBusinessDateKey(params.to)) }
          : {}),
      };
    }

    const take = Math.min(Math.max(Number(params.limit) || 30, 1), 100);
    return this.prisma.dailyClose.findMany({
      where,
      orderBy: { business_date: 'desc' },
      take,
    });
  }

  /** `GET /daily-close/:date` — 404 when the cron has not computed that day. */
  async findByDate(businessDate: string): Promise<DailyClose> {
    const day = assertBusinessDateKey(businessDate);
    const node = await this.node.current();
    const close = await this.prisma.dailyClose.findUnique({
      where: {
        node_id_business_date: {
          node_id: node.id,
          business_date: dayKeyToDate(day),
        },
      },
    });
    if (!close) {
      throw new NotFoundException(`No daily close computed for ${day}`);
    }
    return close;
  }

  /**
   * Every window filter goes through `nodeDayRange`, never
   * `new Date(Date.now() - n)`: a close is a calendar fact in the node's zone,
   * and a rolling 24-hour window would double-count across a DST boundary.
   */
  private async gather(
    node: { id: string; timezone: string; currency: string },
    day: string,
  ): Promise<DailyCloseMetrics> {
    const { start, end } = nodeDayRange(node.timezone, day);
    const window = { gte: start, lt: end };
    const counted: Prisma.OrderWhereInput = {
      node_id: node.id,
      created_at: window,
      status: { notIn: CLOSED_OUT_ORDER_STATUSES },
    };

    const [
      byChannel,
      cancelled,
      refunded,
      refunds,
      waste,
      batchesCreated,
      batchesDepleted,
      reconciliation,
      stockRows,
      shipments,
    ] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['channel'],
        where: counted,
        _count: { _all: true },
        _sum: {
          total: true,
          subtotal: true,
          channel_modifier_amount: true,
          discount_amount: true,
          shipping_amount: true,
          tax_amount: true,
        },
      }),
      this.prisma.order.count({
        where: {
          node_id: node.id,
          created_at: window,
          status: OrderStatus.cancelled,
        },
      }),
      this.prisma.order.count({
        where: {
          node_id: node.id,
          created_at: window,
          status: OrderStatus.refunded,
        },
      }),
      this.prisma.refund.aggregate({
        where: {
          node_id: node.id,
          created_at: window,
          status: RefundStatus.processed,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.wasteLog.groupBy({
        by: ['reason'],
        where: { node_id: node.id, created_at: window },
        _count: { _all: true },
        _sum: { cost_impact: true },
      }),
      this.prisma.prepBatch.count({
        where: { node_id: node.id, created_at: window },
      }),
      // `PrepBatch` carries no `depleted_at`, so "depleted" can only mean a batch
      // opened on this day that is depleted by the time the close runs. P6 does
      // not add the column; the number is honest about what it counts.
      this.prisma.prepBatch.count({
        where: {
          node_id: node.id,
          created_at: window,
          status: PrepBatchStatus.depleted,
        },
      }),
      this.prisma.auditEvent.aggregate({
        where: {
          node_id: node.id,
          created_at: window,
          action: RECONCILIATION_MISMATCH_ACTION,
        },
        _count: { _all: true },
        _max: { created_at: true },
      }),
      // `IngredientStock` has no `node_id` and no timestamp worth windowing —
      // it is the denominator "how many rows could have drifted", read as of now.
      this.prisma.ingredientStock.count(),
      this.prisma.shipment.groupBy({
        by: ['status'],
        where: { node_id: node.id, created_at: window },
        _count: { _all: true },
      }),
    ]);

    const orders = this.foldOrders(byChannel, cancelled, refunded, refunds);

    return {
      version: DAILY_CLOSE_METRICS_VERSION,
      business_date: day,
      timezone: node.timezone,
      currency: node.currency,
      window: { start: start.toISOString(), end: end.toISOString() },
      orders,
      waste: this.foldWaste(waste),
      batches: { created: batchesCreated, depleted: batchesDepleted },
      stock_reconciliation: {
        checked: stockRows,
        drifted: reconciliation._count._all,
        ran_at: reconciliation._max.created_at?.toISOString() ?? null,
      },
      shipments: this.foldShipments(shipments),
      computed_at: new Date().toISOString(),
    };
  }

  private foldOrders(
    byChannel: {
      channel: OrderChannel;
      _count: { _all: number };
      _sum: {
        total: Prisma.Decimal | null;
        subtotal: Prisma.Decimal | null;
        channel_modifier_amount: Prisma.Decimal | null;
        discount_amount: Prisma.Decimal | null;
        shipping_amount: Prisma.Decimal | null;
        tax_amount: Prisma.Decimal | null;
      };
    }[],
    cancelled: number,
    refunded: number,
    refunds: {
      _count: { _all: number };
      _sum: { amount: Prisma.Decimal | null };
    },
  ): DailyCloseOrderMetrics {
    const rows: DailyCloseChannelBreakdown[] = byChannel
      .map((row) => ({
        channel: row.channel,
        orders: row._count._all,
        revenue_paise: sumToPaise(row._sum.total),
      }))
      .sort((a, b) => a.channel.localeCompare(b.channel));

    // Summing per-channel paise rather than issuing a second aggregate: the
    // total and the breakdown are then arithmetically the same number, which is
    // the one property a reader of a signed close checks first.
    const revenue_paise = rows.reduce((sum, row) => sum + row.revenue_paise, 0);
    const tax_paise = byChannel.reduce(
      (sum, row) => sum + sumToPaise(row._sum.tax_amount),
      0,
    );

    return {
      total: rows.reduce((sum, row) => sum + row.orders, 0),
      revenue_paise,
      subtotal_paise: byChannel.reduce(
        (sum, row) => sum + sumToPaise(row._sum.subtotal),
        0,
      ),
      channel_modifier_paise: byChannel.reduce(
        (sum, row) => sum + sumToPaise(row._sum.channel_modifier_amount),
        0,
      ),
      discount_paise: byChannel.reduce(
        (sum, row) => sum + sumToPaise(row._sum.discount_amount),
        0,
      ),
      shipping_paise: byChannel.reduce(
        (sum, row) => sum + sumToPaise(row._sum.shipping_amount),
        0,
      ),
      tax_paise,
      net_revenue_paise: revenue_paise - tax_paise,
      by_channel: rows,
      cancelled,
      refunded,
      refunds: refunds._count._all,
      refund_amount_paise: sumToPaise(refunds._sum.amount),
    };
  }

  private foldWaste(
    rows: {
      reason: string;
      _count: { _all: number };
      _sum: { cost_impact: Prisma.Decimal | null };
    }[],
  ): DailyCloseMetrics['waste'] {
    const by_reason: DailyCloseWasteReason[] = rows
      .map((row) => ({
        reason: row.reason,
        entries: row._count._all,
        cost_paise: sumToPaise(row._sum.cost_impact),
      }))
      .sort(
        (a, b) =>
          b.cost_paise - a.cost_paise || a.reason.localeCompare(b.reason),
      );

    return {
      entries: by_reason.reduce((sum, row) => sum + row.entries, 0),
      cost_paise: by_reason.reduce((sum, row) => sum + row.cost_paise, 0),
      by_reason,
    };
  }

  private foldShipments(
    rows: { status: ShipmentStatus; _count: { _all: number } }[],
  ): DailyCloseMetrics['shipments'] {
    const folded = { open: 0, failed: 0, delivered: 0, cancelled: 0 };
    for (const row of rows) {
      if (row.status === ShipmentStatus.delivered) {
        folded.delivered += row._count._all;
      } else if (FAILED_SHIPMENT_STATUSES.includes(row.status)) {
        folded.failed += row._count._all;
      } else if (OPEN_SHIPMENT_STATUSES.includes(row.status)) {
        folded.open += row._count._all;
      } else {
        folded.cancelled += row._count._all;
      }
    }
    return folded;
  }
}
