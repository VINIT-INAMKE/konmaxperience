/**
 * SPEC §4.3 / §6.5 — readiness meters carry three published numbers, not one:
 * `task_value` (validated task contributions), `derived_value` (formula output
 * over live ops state) and `current_value`, the blend the rest of the app reads.
 */
export type MeterMode = 'task_driven' | 'derived' | 'hybrid';

export interface ReadinessMeter {
  id: string;
  code: string;
  name: string;
  description: string;
  current_value: number;
  target_value: number;
  weight: number;
  mode: MeterMode;
  formula_key: string | null;
  task_value: number;
  derived_value: number | null;
  last_computed_at: string | null;
}

/** One day of `ReadinessSnapshot` history; today's point is the live value. */
export interface MeterHistoryPoint {
  /** `YYYY-MM-DD` in the node timezone. */
  date: string;
  value: number;
}

/** `GET /readiness-meters/:code/history?days=90` */
export interface MeterHistoryResponse {
  code: string;
  name: string;
  mode: MeterMode;
  formula_key: string | null;
  current_value: number;
  task_value: number;
  derived_value: number | null;
  target_value: number;
  last_computed_at: string | null;
  /** The window the backend actually served after clamping `days`. */
  days: number;
  points: MeterHistoryPoint[];
}

/** `GET /readiness-meters/:code/signals?limit=20` */
export interface MeterSignal {
  id: string;
  source_event: string;
  source_type: string;
  source_id: string;
  /** `Decimal(14,4)` — serialises as a string. */
  value: string;
  created_at: string;
}

/** `POST /readiness-meters/recompute` */
export interface MeterRecomputeResult {
  code: string;
  value: number;
}

export interface MeterTaskEvent {
  id: string;
  task_id: string;
  value: number;
  created_at: string;
  task: {
    id: string;
    title: string;
    valid_xp: number;
    owner: { id: string; name: string };
  };
}

/**
 * `derived-meters.ts:118` — which derived meter each hybrid formula blends with.
 * Used only to name the partner in the breakdown; the arithmetic is the backend's.
 */
export const HYBRID_PARTNER_METER: Record<string, string> = {
  hybrid_backend_v1: 'Standardization',
  hybrid_frontend_v1: 'Sales',
};
