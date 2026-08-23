import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NodeService } from '../node/node.service';
import { nodeDayKey } from '../common/utils/node-time';
import type {
  MeterHistoryPoint,
  MeterHistoryResponse,
} from './dto/meter-history.dto';

/** `GET /readiness-meters/:code/signals` — default and hard cap on `limit`. */
export const DEFAULT_SIGNAL_LIMIT = 20;
export const MAX_SIGNAL_LIMIT = 100;

/** `ReadinessSnapshot.date` is a bare `@db.Date`, so Prisma hands back UTC midnight. */
const snapshotDayKey = (date: Date): string => date.toISOString().slice(0, 10);

/** `YYYY-MM-DD` → the UTC midnight instant a `@db.Date` column compares against. */
const dayKeyToDate = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

/** `YYYY-MM-DD` shifted by whole calendar days. */
function shiftDayKey(key: string, days: number): string {
  const date = dayKeyToDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return snapshotDayKey(date);
}

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly node: NodeService,
  ) {}

  async findAll() {
    return this.prisma.readinessMeter.findMany({
      orderBy: { code: 'asc' },
    });
  }

  /** Meter lookup by SPEC code rather than id — 404s naming the code. */
  async findByCode(code: string) {
    const node_id = await this.node.currentId();
    const meter = await this.prisma.readinessMeter.findUnique({
      where: { node_id_code: { node_id, code } },
    });
    if (!meter) {
      throw new NotFoundException(`Readiness meter ${code} not found`);
    }
    return meter;
  }

  /**
   * SPEC §9 — `GET /readiness-meters/:code/history?days=90`.
   *
   * Daily `ReadinessSnapshot` rows oldest-first, with today's point always taken
   * from the live `current_value`: the meter row is fresher than a snapshot the
   * nightly job wrote at the start of the day.
   */
  async history(code: string, days: number): Promise<MeterHistoryResponse> {
    const meter = await this.findByCode(code);
    const cfg = await this.settings.get('readiness');

    const window = this.resolveWindow(
      days,
      cfg.history_default_days,
      cfg.history_max_days,
    );
    const timezone = await this.node.timezone();
    const todayKey = nodeDayKey(timezone, new Date());
    const fromKey = shiftDayKey(todayKey, -(window - 1));

    const snapshots = await this.prisma.readinessSnapshot.findMany({
      where: { meter_id: meter.id, date: { gte: dayKeyToDate(fromKey) } },
      orderBy: { date: 'asc' },
      select: { date: true, value: true },
    });

    const points: MeterHistoryPoint[] = snapshots
      .map((s) => ({ date: snapshotDayKey(s.date), value: Number(s.value) }))
      .filter((p) => p.date !== todayKey);
    points.push({ date: todayKey, value: meter.current_value });

    return {
      code: meter.code,
      name: meter.name,
      mode: meter.mode,
      formula_key: meter.formula_key,
      current_value: meter.current_value,
      task_value: meter.task_value,
      derived_value: meter.derived_value,
      target_value: meter.target_value,
      last_computed_at: meter.last_computed_at,
      days: window,
      points,
    };
  }

  /** The ops-derived contribution ledger behind a derived meter, newest first. */
  async signals(code: string, limit: number) {
    const meter = await this.findByCode(code);
    const take = Math.min(
      Math.max(this.toPositiveInt(limit) ?? DEFAULT_SIGNAL_LIMIT, 1),
      MAX_SIGNAL_LIMIT,
    );
    return this.prisma.readinessSignal.findMany({
      where: { meter_id: meter.id },
      orderBy: { created_at: 'desc' },
      take,
    });
  }

  async findTasksForMeter(meterId: string) {
    const meter = await this.prisma.readinessMeter.findUnique({
      where: { id: meterId },
    });

    if (!meter) {
      throw new NotFoundException(
        `Readiness meter with ID ${meterId} not found`,
      );
    }

    return this.prisma.taskReadinessEvent.findMany({
      where: {
        readiness_meter_id: meterId,
        revoked_at: null,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            valid_xp: true,
            owner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /** Absent/garbage falls back to the configured default; anything above the cap is clamped. */
  private resolveWindow(days: number, fallback: number, max: number): number {
    const requested = this.toPositiveInt(days) ?? fallback;
    return Math.min(Math.max(requested, 1), max);
  }

  private toPositiveInt(value: number): number | null {
    if (!Number.isFinite(value)) return null;
    const truncated = Math.trunc(value);
    return truncated >= 1 ? truncated : null;
  }
}
