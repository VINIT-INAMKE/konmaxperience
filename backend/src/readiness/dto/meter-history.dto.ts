import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import type { MeterMode } from '@prisma/client';

/**
 * SPEC §9 — `GET /readiness-meters/:code/history?days=90`.
 *
 * `days` is clamped server-side into `[1, readiness.history_max_days]` and falls
 * back to `readiness.history_default_days` when absent, so a caller can only ever
 * narrow the window, never blow past the configured cap.
 */
export class MeterHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}

/** One day of a meter's published value. `date` is `YYYY-MM-DD` in the node's timezone. */
export interface MeterHistoryPoint {
  date: string;
  value: number;
}

/**
 * The history envelope. `points` is the contract Task 12/13/15 and the Phase 32
 * frontend consume; the meter fields ride along so the detail panel can render the
 * mode badge and the task/derived breakdown from one request.
 */
export interface MeterHistoryResponse {
  code: string;
  name: string;
  mode: MeterMode;
  formula_key: string | null;
  current_value: number;
  task_value: number;
  derived_value: number | null;
  target_value: number;
  last_computed_at: Date | null;
  /** The effective window after clamping, in days. */
  days: number;
  points: MeterHistoryPoint[];
}
