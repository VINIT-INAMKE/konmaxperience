import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ApprovalStatus,
  DecisionStatus,
  NotificationType,
  ShipmentStatus,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NodeService } from '../../node/node.service';
import { ReadinessService } from '../../readiness/readiness.service';
import { InventoryService } from '../../inventory/inventory.service';
import { NotificationDispatcher } from '../../notifications/notification-dispatcher.service';
import { AiProviderResolver } from '../ai-provider.resolver';
import { toDecimal } from '../../common/money/money';
import { nodeDayKey } from '../../common/utils/node-time';
import { previousDayKey } from '../../daily-close/daily-close.cron';
import {
  DAILY_CLOSE_METRICS_VERSION,
  FAILED_SHIPMENT_STATUSES,
  OPEN_SHIPMENT_STATUSES,
  assertBusinessDateKey,
  dateToDayKey,
  dayKeyToDate,
} from '../../daily-close/daily-close.service';
import type { DailyCloseMetrics } from '../../daily-close/daily-close.service';
import type { MorningBriefInput, MorningBriefResult } from '../ai.types';

/** Where a brief notification points. Mission Control renders the card there. */
export const MORNING_BRIEF_LINK_URL = '/dashboard';

/** `Notification.reference_type` on every brief row. */
export const MORNING_BRIEF_REFERENCE_TYPE = 'morning_brief';

/** A `proposed` decision older than this is reported as stale. */
export const STALE_DECISION_DAYS = 7;

/** The readiness comparison window RUN-05 asks for. */
export const READINESS_DELTA_DAYS = 7;

/**
 * Days of history to request per meter: the delta window plus today, because
 * `ReadinessService.history` returns `[today - (days - 1) .. today]` and the
 * brief needs both ends of the comparison inside one response.
 */
export const READINESS_WINDOW_DAYS = READINESS_DELTA_DAYS + 1;

/** Longest low-stock list the brief carries. The prompt must stay bounded. */
export const LOW_STOCK_BRIEF_LIMIT = 8;

/**
 * Appended when the day's close has not been computed. The zeroes in the input
 * are then a *fact about the close*, not a claim about the day, and the brief
 * says which — decision 16's rule read from the other side: the brief never
 * recomputes behind the close's back, so it must admit when there is nothing to
 * read.
 */
export const MISSING_CLOSE_BULLET =
  'The daily close for this date has not been computed yet, so sales and waste are reported as zero.';

const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` shifted by whole calendar days, in UTC arithmetic on the key. */
function shiftDayKey(day: string, days: number): string {
  const date = dayKeyToDate(day);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToDayKey(date);
}

/** Integer paise (the only money shape a close carries) -> rupees, exactly. */
function paiseToRupees(paise: number): number {
  return toDecimal(Math.trunc(paise)).toNumber();
}

/** Two decimals, without the float noise that would reach the prompt verbatim. */
function round2(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function isBlock(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `DailyClose.metrics` is `Json`, so it arrives untyped and possibly written by
 * an older version of the close. A shape this file does not recognise is
 * treated exactly like a missing close — zeroes plus {@link MISSING_CLOSE_BULLET}
 * — rather than being read field-by-field on a guess.
 */
export function readCloseMetrics(raw: unknown): DailyCloseMetrics | null {
  if (!isBlock(raw)) return null;
  if (raw.version !== DAILY_CLOSE_METRICS_VERSION) return null;
  if (!isBlock(raw.orders) || !isBlock(raw.waste)) return null;
  return raw as unknown as DailyCloseMetrics;
}

/** What {@link MorningBriefService.gather} answers with. */
export interface MorningBriefGathered {
  /** Exactly the payload handed to the provider. */
  input: MorningBriefInput;
  /**
   * False when no `DailyClose` exists for the date (or it carries metrics of an
   * unrecognised version). The sales and waste figures are then zero *because
   * nothing was read*, and the caller appends {@link MISSING_CLOSE_BULLET}.
   */
  close_available: boolean;
}

/** What one generate-and-deliver produced. Echoed by the controller and the cron. */
export interface MorningBriefDelivery extends MorningBriefResult {
  business_date: string;
  /** Leads who actually received a row. A cooldown suppression is not counted. */
  delivered_to: number;
  /** Leads the configured roles resolved to, before the cooldown. */
  recipients: number;
  close_available: boolean;
}

/**
 * RUN-05 — the 07:00 brief.
 *
 * Nothing in this file computes a new number. Sales and waste are read out of
 * the previous day's `DailyClose.metrics`, so the brief and the close can never
 * disagree — which is the failure mode that makes a generated summary
 * untrustworthy. Everything else (approvals waiting, tasks blocked, decisions
 * gone stale, shipments open, stock below minimum) is a *live backlog* question
 * — what a lead should look at this morning — and is deliberately asked of the
 * present rather than of the closed day.
 *
 * The AI boundary (SPEC §1.2) is why the readiness figures come from
 * `ReadinessService` rather than from the meter rows: this module reads the
 * published series and writes no meter, and `ai-boundaries.spec.ts` proves off
 * disk that no file here can even name a meter's value column.
 */
@Injectable()
export class MorningBriefService {
  private readonly logger = new Logger(MorningBriefService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: AiProviderResolver,
    private readonly node: NodeService,
    private readonly readiness: ReadinessService,
    private readonly inventory: InventoryService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  /** The `ai` settings gate, so a cron can skip quietly instead of throwing. */
  async enabled(): Promise<boolean> {
    return (await this.resolver.settings()).morning_brief_enabled;
  }

  /**
   * The node-local day a brief reports on: **yesterday**. At 07:00 the day that
   * just ended is the one with a complete set of orders in it, and it is the
   * day the 00:45 close has already computed.
   */
  async previousBusinessDate(now: Date = new Date()): Promise<string> {
    return previousDayKey(nodeDayKey(await this.node.timezone(), now));
  }

  /**
   * Assembles the `MorningBriefInput` from state that already exists.
   *
   * `businessDate` is a node-local `YYYY-MM-DD` — the same key
   * `DailyCloseService` and `MorningBriefInput.business_date` speak, so no date
   * is ever converted between the close and the brief.
   */
  async gather(businessDate: string): Promise<MorningBriefGathered> {
    const day = assertBusinessDateKey(businessDate);
    const nodeId = await this.node.currentId();

    const [close, readiness, pending, shipments, lowStock] = await Promise.all([
      this.prisma.dailyClose.findUnique({
        where: {
          node_id_business_date: {
            node_id: nodeId,
            business_date: dayKeyToDate(day),
          },
        },
        select: { metrics: true },
      }),
      this.gatherReadiness(),
      this.gatherPending(),
      this.gatherShipments(),
      this.gatherLowStock(),
    ]);

    const metrics = readCloseMetrics(close?.metrics);

    return {
      close_available: metrics !== null,
      input: {
        business_date: day,
        readiness,
        sales: this.foldSales(metrics),
        waste: this.foldWaste(metrics),
        pending,
        shipments,
        low_stock: lowStock,
      },
    };
  }

  /**
   * Generates the brief and delivers it. Returns what was delivered so the
   * controller and the cron can echo it without re-reading anything.
   */
  async generateAndDeliver(
    businessDate: string,
  ): Promise<MorningBriefDelivery> {
    const cfg = await this.resolver.settings();
    if (!cfg.morning_brief_enabled) {
      throw new BadRequestException('Morning brief is disabled');
    }

    const { input, close_available } = await this.gather(businessDate);
    // The provider degrades to the heuristic internally (decision 2); a
    // try/catch here would only hide which one answered.
    const provider = await this.resolver.get();
    const generated = await provider.writeMorningBrief(input);
    const brief: MorningBriefResult = close_available
      ? generated
      : { ...generated, bullets: [...generated.bullets, MISSING_CLOSE_BULLET] };

    const leads = cfg.morning_brief_role_codes.length
      ? await this.prisma.user.findMany({
          where: {
            status: 'active',
            role: { code: { in: cfg.morning_brief_role_codes } },
          },
          select: { id: true },
        })
      : [];

    const body = this.renderBody(brief);
    let delivered = 0;
    for (const lead of leads) {
      // Through the dispatcher (decision 24) so WhatsApp inherits opt-in, quiet
      // hours and the cooldown. `reference_id` is the business date, so a
      // re-run on the same day is suppressed rather than duplicated. One lead's
      // failure must not cost the others their brief.
      try {
        const sent = await this.dispatcher.dispatch({
          user_id: lead.id,
          type: NotificationType.morning_brief,
          title: brief.headline,
          body,
          link_url: MORNING_BRIEF_LINK_URL,
          reference_id: input.business_date,
          reference_type: MORNING_BRIEF_REFERENCE_TYPE,
          template_ctx: { headline: brief.headline },
        });
        if (sent) delivered += 1;
      } catch (error) {
        this.logger.error(
          `Could not deliver the ${input.business_date} morning brief to ${lead.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      ...brief,
      business_date: input.business_date,
      delivered_to: delivered,
      recipients: leads.length,
      close_available,
    };
  }

  /**
   * What Mission Control renders: the signed-in user's most recent brief
   * notification, or `null` on a day with no brief so the card drops rather
   * than breaking the dashboard (decision 24).
   */
  async latestForUser(userId: string) {
    return this.prisma.notification.findFirst({
      where: { user_id: userId, type: NotificationType.morning_brief },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        title: true,
        body: true,
        link_url: true,
        reference_id: true,
        is_read: true,
        created_at: true,
      },
    });
  }

  /** Headline, bullets, then the actions — one string, rendered verbatim. */
  private renderBody(brief: MorningBriefResult): string {
    return [
      brief.headline,
      '',
      ...brief.bullets.map((b) => `• ${b}`),
      ...(brief.actions.length
        ? ['', 'Today:', ...brief.actions.map((a) => `→ ${a}`)]
        : []),
    ].join('\n');
  }

  /**
   * Published meter values and their 7-day movement, read through
   * `ReadinessService.history`: its last point is the live meter value and the
   * earlier points are `ReadinessSnapshot` rows, which is exactly the pair
   * RUN-05 asks for — without this module touching a meter column.
   *
   * A meter with no snapshot seven days back reports `delta_7d: 0` rather than
   * a delta measured against zero, which would read as a collapse that never
   * happened.
   */
  private async gatherReadiness(): Promise<MorningBriefInput['readiness']> {
    const meters = await this.readiness.findAll();
    const histories = await Promise.all(
      meters.map((meter) =>
        this.readiness.history(meter.code, READINESS_WINDOW_DAYS),
      ),
    );

    return histories.flatMap((history) => {
      const latest = history.points[history.points.length - 1];
      if (!latest) return [];
      const priorKey = shiftDayKey(latest.date, -READINESS_DELTA_DAYS);
      const prior = history.points.find((p) => p.date === priorKey);
      return [
        {
          code: history.code,
          value: round2(latest.value),
          delta_7d: prior ? round2(latest.value - prior.value) : 0,
        },
      ];
    });
  }

  /** The three backlogs a lead can act on before lunch. */
  private async gatherPending(): Promise<MorningBriefInput['pending']> {
    const staleBefore = new Date(Date.now() - STALE_DECISION_DAYS * MS_PER_DAY);

    const [approvals, blockers, stale_decisions] = await Promise.all([
      this.prisma.approval.count({ where: { status: ApprovalStatus.pending } }),
      this.prisma.task.count({ where: { status: TaskStatus.blocked } }),
      this.prisma.decision.count({
        where: {
          status: DecisionStatus.proposed,
          created_at: { lt: staleBefore },
        },
      }),
    ]);

    return { approvals, blockers, stale_decisions };
  }

  /**
   * The *live* parcel backlog, not the closed day's: a shipment created three
   * days ago and still in transit is this morning's problem, and the close's
   * own `shipments` block deliberately counts only what was created that day.
   */
  private async gatherShipments(): Promise<MorningBriefInput['shipments']> {
    const rows = (await this.prisma.shipment.groupBy({
      by: ['status'],
      _count: { _all: true },
    })) as unknown as {
      status: ShipmentStatus;
      _count: { _all: number };
    }[];

    const folded = { open: 0, failed: 0 };
    for (const row of rows) {
      if (FAILED_SHIPMENT_STATUSES.includes(row.status)) {
        folded.failed += row._count._all;
      } else if (OPEN_SHIPMENT_STATUSES.includes(row.status)) {
        folded.open += row._count._all;
      }
    }
    return folded;
  }

  /**
   * Stock below its minimum, worst shortfall first and capped — a brief that
   * lists forty ingredients is one nobody reads. `InventoryService.getLowStock`
   * owns the cross-column comparison Prisma cannot express in a `where`.
   */
  private async gatherLowStock(): Promise<MorningBriefInput['low_stock']> {
    const rows = await this.inventory.getLowStock();

    return rows
      .map((row) => {
        const on_hand = round2(Number(row.current_quantity));
        const minimum = round2(Number(row.ingredient.min_stock_level));
        return {
          ingredient: `${row.ingredient.name} (${row.ingredient.base_unit})`,
          on_hand,
          minimum,
        };
      })
      .sort(
        (a, b) =>
          b.minimum - b.on_hand - (a.minimum - a.on_hand) ||
          a.ingredient.localeCompare(b.ingredient),
      )
      .slice(0, LOW_STOCK_BRIEF_LIMIT);
  }

  /** `DailyCloseOrderMetrics` (integer paise) -> the brief's rupee figures. */
  private foldSales(
    metrics: DailyCloseMetrics | null,
  ): MorningBriefInput['sales'] {
    if (!metrics) return { orders: 0, revenue: 0, by_channel: [] };
    return {
      orders: metrics.orders.total,
      revenue: paiseToRupees(metrics.orders.revenue_paise),
      by_channel: metrics.orders.by_channel.map((row) => ({
        channel: row.channel,
        orders: row.orders,
        revenue: paiseToRupees(row.revenue_paise),
      })),
    };
  }

  private foldWaste(
    metrics: DailyCloseMetrics | null,
  ): MorningBriefInput['waste'] {
    if (!metrics) return { entries: 0, cost: 0 };
    return {
      entries: metrics.waste.entries,
      cost: paiseToRupees(metrics.waste.cost_paise),
    };
  }
}
