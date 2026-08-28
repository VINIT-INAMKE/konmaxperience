/** IA-07 / SPEC §8 — `POST /usage` telemetry. Mirrors `CreateUsageEventDto`. */
export type UsageEventType = 'page_view' | 'action';

export interface UsageEventPayload {
  event_type: UsageEventType;
  /** Route path with the query string already stripped — ids never leave the client. */
  path?: string;
  /** Dotted action key, e.g. `task.create`. Only on `event_type: 'action'`. */
  action?: string;
  meta?: Record<string, unknown>;
}

/**
 * The closed list of instrumented actions (SPEC §8 "key actions"). Deliberately
 * short: telemetry that records every click answers no question. Add a key here
 * before calling `trackAction`, so the vocabulary stays greppable and the
 * backend's `by_action` summary stays readable.
 */
export const USAGE_ACTIONS = {
  TASK_CREATE: 'task.create',
  TASK_STATUS_CHANGE: 'task.status_change',
  TASK_VALIDATE: 'task.validate',
  EVIDENCE_UPLOAD: 'evidence.upload',
  APPROVAL_DECIDE: 'approval.decide',
  QUEST_CREATE: 'quest.create',
  ORDER_PLACE: 'order.place',
  KDS_ITEM_READY: 'kds.item_ready',
  IMPORT_RUN: 'import.run',
  EXPORT_RUN: 'export.run',
  MODULE_ACCESS_UPDATE: 'module_access.update',
} as const;

export type UsageAction = (typeof USAGE_ACTIONS)[keyof typeof USAGE_ACTIONS];

/* -------------------------------------------------------------------------- */
/* RUN-04 — `GET /usage/summary`, the `/admin/usage` roll-up.                  */
/* -------------------------------------------------------------------------- */

/** One row of `by_role`. Includes the synthetic `CUSTOMER` role — see {@link CUSTOMER_ROLE_CODE}. */
export interface UsageRoleBucket {
  role_code: string;
  count: number;
}

/** One row of `by_path`. `page_view` events only, busiest first, capped at 25 server-side. */
export interface UsagePathBucket {
  path: string;
  count: number;
}

/** One row of `by_action`. `action` events only, busiest first, capped at 25 server-side. */
export interface UsageActionBucket {
  action: string;
  count: number;
}

/**
 * One row of `by_user`. Staff only — storefront traffic carries no `user_id` and
 * shows up under {@link CUSTOMER_ROLE_CODE} in `by_role` instead. A user with no
 * event inside the window is absent from the array entirely, so this list is
 * "who was active", never "everyone".
 */
export interface UsageUserRow {
  user_id: string;
  name: string;
  /** The user's **current** role code, not the role recorded at event time. */
  role_code: string;
  page_views: number;
  actions: number;
  /** ISO-8601 UTC instant of the newest event in the window; `null` when unknown. */
  last_seen_at: string | null;
}

/** One node-local calendar day of page views. The series is dense — see {@link UsageSummary.daily}. */
export interface UsageDailyPoint {
  /** `YYYY-MM-DD`, node-local. */
  date: string;
  count: number;
}

/** Response of `GET /usage/summary` (permission `MANAGE_SYSTEM`). */
export interface UsageSummary {
  /** Length of the window in node-local calendar days, both ends inclusive. */
  days: number;
  /** First node-local day in the window, `YYYY-MM-DD`, inclusive. */
  from: string;
  /** Last node-local day in the window, `YYYY-MM-DD`, inclusive. */
  to: string;
  by_role: UsageRoleBucket[];
  by_path: UsagePathBucket[];
  by_action: UsageActionBucket[];
  /** Sorted most-recently-seen first, ties broken by name. */
  by_user: UsageUserRow[];
  /**
   * Page views per node-local day, ascending. **Dense**: exactly `days` entries,
   * a quiet day present with `0`, so a chart needs no gap-filling of its own.
   */
  daily: UsageDailyPoint[];
}

/**
 * `UsageEvent.role_code` for storefront traffic: a synthetic code that no
 * `Role.code` may collide with, recorded with `user_id: null`. It appears as its
 * own row in `by_role` and never in `by_user`.
 */
export const CUSTOMER_ROLE_CODE = 'CUSTOMER';

/** Window lengths the dashboard's range selector offers. */
export const USAGE_RANGE_DAYS = [7, 30, 90] as const;

export type UsageRangeDays = (typeof USAGE_RANGE_DAYS)[number];
