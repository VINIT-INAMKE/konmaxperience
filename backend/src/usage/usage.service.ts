import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, UsageEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsageEventDto } from './dto/create-usage-event.dto';
import { nodeDateRange, nodeDayKey } from '../common/utils/node-time';

/**
 * The `/admin/usage` payload (RUN-04). Every window boundary is a **node-local**
 * calendar day, not a rolling `now - n × 24h` slice, so this panel and the
 * analytics screens mean the same thing by "the last 30 days" (decision 23).
 */
export interface UsageSummary {
  /** Length of the window in node-local calendar days, both ends inclusive. */
  days: number;
  /** First node-local day in the window, `YYYY-MM-DD`, inclusive. */
  from: string;
  /** Last node-local day in the window, `YYYY-MM-DD`, inclusive. */
  to: string;
  /** Every event in the window, split by the role recorded **at event time**. */
  by_role: { role_code: string; count: number }[];
  /** Top page-view paths, busiest first, capped at {@link SUMMARY_BUCKET_LIMIT}. */
  by_path: { path: string; count: number }[];
  /** Top action keys, busiest first, capped at {@link SUMMARY_BUCKET_LIMIT}. */
  by_action: { action: string; count: number }[];
  /**
   * RUN-04 "last-seen per user" — derived from `max(created_at) group by user_id`
   * over the existing `@@index([user_id, created_at])`, not from a `last_seen_at`
   * column (decision 23). Storefront traffic is excluded: it carries
   * `user_id: null` under {@link CUSTOMER_ROLE_CODE} and appears in `by_role` only.
   * A user with no event inside the window is absent from this array entirely.
   * Sorted most-recently-seen first, ties broken by name.
   */
  by_user: {
    user_id: string;
    name: string;
    /** The user's **current** role code, not the role recorded at event time. */
    role_code: string;
    page_views: number;
    actions: number;
    /** ISO-8601 UTC instant of the user's newest event in the window. */
    last_seen_at: string | null;
  }[];
  /**
   * Page views per node-local day, ascending, for the dashboard's sparkline.
   * Always exactly `days` entries: a day with no traffic is present with `0`.
   */
  daily: { date: string; count: number }[];
}

/** Caller-resolved window for {@link UsageService.summary}. */
export interface UsageSummaryOptions {
  /**
   * IANA zone the day boundaries are drawn in, from `NodeService.timezone()`.
   * Passed in rather than injected so `UsageService` keeps a single dependency
   * (`PrismaService`) on the fire-and-forget ingest path that `CustomersModule`
   * wires into `CustomerPresenceService`.
   */
  timeZone: string;
  /** Rolling window length in days; ignored when both `from` and `to` are given. */
  days?: number;
  from?: string;
  to?: string;
}

export const SUMMARY_DEFAULT_DAYS = 30;
export const SUMMARY_MAX_DAYS = 365;
export const SUMMARY_BUCKET_LIMIT = 25;

/**
 * `UsageEvent.role_code` is a non-null `String` and `user_id` an optional FK to
 * `User`, so a storefront visitor is recorded as `user_id: null` under this
 * synthetic role. It is deliberately not a `Role.code` — no staff role may ever
 * collide with it — and it is what makes the storefront show up as its own row
 * in `GET /usage/summary`'s `by_role` bucket.
 */
export const CUSTOMER_ROLE_CODE = 'CUSTOMER';

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM-DD` shifted by whole calendar days. UTC arithmetic on the calendar
 * parts, so it never consults a zone — the parts *are* the node-local day.
 */
function shiftDayKey(day: string, delta: number): string {
  const match = DAY_PATTERN.exec(day);
  if (!match) {
    throw new BadRequestException(
      `Expected a YYYY-MM-DD date string, received "${day}"`,
    );
  }
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + delta),
  )
    .toISOString()
    .slice(0, 10);
}

/** Inclusive count of calendar days between two `YYYY-MM-DD` keys. */
function inclusiveDayCount(from: string, to: string): number {
  const parse = (day: string) => {
    const match = DAY_PATTERN.exec(day);
    if (!match) {
      throw new BadRequestException(
        `Expected a YYYY-MM-DD date string, received "${day}"`,
      );
    }
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000) + 1;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget. A telemetry write must never fail a user's request, so every
   * error is swallowed after a debug log — the caller already returned 202.
   */
  async record(
    dto: CreateUsageEventDto,
    actor: { id: string; roleCode: string },
  ): Promise<void> {
    try {
      await this.prisma.usageEvent.create({
        data: {
          user_id: actor.id,
          role_code: actor.roleCode,
          event_type: dto.event_type,
          path:
            dto.event_type === UsageEventType.page_view
              ? (dto.path ?? null)
              : null,
          action:
            dto.event_type === UsageEventType.action
              ? (dto.action ?? null)
              : null,
          meta: (dto.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.debug(`usage event dropped: ${(err as Error).message}`);
    }
  }

  /**
   * One storefront beat, written by `CustomerPresenceService` at most once per
   * customer per presence window — never once per request.
   *
   * Same fire-and-forget contract as {@link record}: a dropped telemetry row is
   * strictly better than a failed customer action, so every error is swallowed
   * after a debug log. `user_id` stays `null` because a `Customer` is not a
   * `User`; the customer id travels in `meta` where no FK constrains it.
   */
  async recordCustomerVisit(input: {
    customerId: string;
    path?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.usageEvent.create({
        data: {
          user_id: null,
          role_code: CUSTOMER_ROLE_CODE,
          event_type: UsageEventType.page_view,
          path: input.path ?? null,
          action: null,
          meta: { customer_id: input.customerId },
        },
      });
    } catch (err) {
      this.logger.debug(
        `customer usage event dropped: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Resolve the requested window to a pair of inclusive node-local day keys.
   *
   * - neither `from` nor `to` → the `days` most recent local days, ending today
   * - `to` only              → the `days` most recent local days, ending `to`
   * - `from` only            → `from` .. today
   * - both                   → `from` .. `to`, and `days` becomes their span
   */
  private resolveWindow(options: UsageSummaryOptions): {
    from: string;
    to: string;
    days: number;
  } {
    const today = nodeDayKey(options.timeZone, new Date());
    const to = options.to ?? today;

    if (options.from) {
      if (options.from > to) {
        throw new BadRequestException('`from` must not be after `to`');
      }
      const days = inclusiveDayCount(options.from, to);
      if (days > SUMMARY_MAX_DAYS) {
        throw new BadRequestException(
          `Window must not exceed ${SUMMARY_MAX_DAYS} days`,
        );
      }
      return { from: options.from, to, days };
    }

    const requested = Math.trunc(options.days ?? SUMMARY_DEFAULT_DAYS);
    const days = Math.min(
      Math.max(
        Number.isFinite(requested) ? requested : SUMMARY_DEFAULT_DAYS,
        1,
      ),
      SUMMARY_MAX_DAYS,
    );
    return { from: shiftDayKey(to, -(days - 1)), to, days };
  }

  /** Admin roll-up behind `GET /usage/summary` (RUN-04). */
  async summary(options: UsageSummaryOptions): Promise<UsageSummary> {
    const { timeZone } = options;
    const { from, to, days } = this.resolveWindow(options);
    // `end` is the start of the day after `to`, so no millisecond of the last
    // local day is missed — an event at 23:30 IST on `to` is inside the window.
    const { start, end } = nodeDateRange(timeZone, from, to);
    const window = { created_at: { gte: start, lt: end } };

    const [byRole, byPath, byAction, byUser, dailyRows] = await Promise.all([
      this.prisma.usageEvent.groupBy({
        by: ['role_code'],
        where: window,
        _count: { _all: true },
      }),
      this.prisma.usageEvent.groupBy({
        by: ['path'],
        where: {
          ...window,
          event_type: UsageEventType.page_view,
          path: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { path: 'desc' } },
        take: SUMMARY_BUCKET_LIMIT,
      }),
      this.prisma.usageEvent.groupBy({
        by: ['action'],
        where: {
          ...window,
          event_type: UsageEventType.action,
          action: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: SUMMARY_BUCKET_LIMIT,
      }),
      // One grouped read for every user in the window — the page-view/action
      // split and the last-seen instant both fall out of it, so resolving names
      // costs exactly one further query and never N+1.
      this.prisma.usageEvent.groupBy({
        by: ['user_id', 'event_type'],
        where: { ...window, user_id: { not: null } },
        _count: { _all: true },
        _max: { created_at: true },
      }),
      // The only shape Prisma's `groupBy` cannot express: bucketing by the
      // node-local calendar day of a `timestamptz`.
      this.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT to_char(
                 date_trunc('day', "created_at" AT TIME ZONE ${timeZone}::text),
                 'YYYY-MM-DD'
               ) AS date,
               count(*)::int AS count
        FROM "UsageEvent"
        WHERE "created_at" >= ${start}
          AND "created_at" < ${end}
          AND "event_type"::text = ${UsageEventType.page_view}
        GROUP BY 1
        ORDER BY 1 ASC`,
    ]);

    return {
      days,
      from,
      to,
      by_role: byRole.map((r) => ({
        role_code: r.role_code,
        count: r._count._all,
      })),
      // `path: { not: null }` above makes the null bucket unreachable; `flatMap`
      // narrows the type without an assertion.
      by_path: byPath.flatMap((r) =>
        r.path === null ? [] : [{ path: r.path, count: r._count._all }],
      ),
      by_action: byAction.flatMap((r) =>
        r.action === null ? [] : [{ action: r.action, count: r._count._all }],
      ),
      by_user: await this.buildByUser(byUser),
      daily: this.fillDailySeries(from, days, dailyRows),
    };
  }

  /**
   * Resolve the grouped `(user_id, event_type)` rows into one row per user with
   * a name and current role. One `findMany` for the whole set.
   */
  private async buildByUser(
    grouped: {
      user_id: string | null;
      event_type: UsageEventType;
      _count: { _all: number };
      _max: { created_at: Date | null };
    }[],
  ): Promise<UsageSummary['by_user']> {
    const totals = new Map<
      string,
      { page_views: number; actions: number; last_seen: Date | null }
    >();
    for (const row of grouped) {
      if (!row.user_id) continue;
      const entry = totals.get(row.user_id) ?? {
        page_views: 0,
        actions: 0,
        last_seen: null,
      };
      if (row.event_type === UsageEventType.page_view) {
        entry.page_views += row._count._all;
      } else {
        entry.actions += row._count._all;
      }
      const seen = row._max.created_at;
      if (seen && (!entry.last_seen || seen > entry.last_seen)) {
        entry.last_seen = seen;
      }
      totals.set(row.user_id, entry);
    }

    const ids = [...totals.keys()];
    if (ids.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, role: { select: { code: true } } },
    });

    // A row with no counted events is not "seen 0 times", it is a user who was
    // never in the window — the `id: { in: ids }` filter already excludes them,
    // and anything that slips through is dropped rather than rendered as a line
    // of zeroes. Likewise a `user_id` with no `User` row (a torn read; the FK is
    // `onDelete: SetNull`, so a deleted user's events leave the set with it).
    return users
      .flatMap((user) => {
        const entry = totals.get(user.id);
        if (!entry) return [];
        return [
          {
            user_id: user.id,
            name: user.name,
            role_code: user.role.code,
            page_views: entry.page_views,
            actions: entry.actions,
            last_seen_at: entry.last_seen
              ? entry.last_seen.toISOString()
              : null,
          },
        ];
      })
      .sort(
        (a, b) =>
          (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? '') ||
          a.name.localeCompare(b.name),
      );
  }

  /**
   * Expand the sparse `date_trunc` result into a dense, ascending series of
   * exactly `days` entries. A gap in a sparkline reads as "we lost the data",
   * not "nobody came in".
   */
  private fillDailySeries(
    from: string,
    days: number,
    rows: { date: string; count: number }[],
  ): UsageSummary['daily'] {
    const counts = new Map(rows.map((r) => [r.date, Number(r.count)]));
    const series: UsageSummary['daily'] = [];
    let day = from;
    for (let i = 0; i < days; i += 1) {
      series.push({ date: day, count: counts.get(day) ?? 0 });
      day = shiftDayKey(day, 1);
    }
    return series;
  }
}
