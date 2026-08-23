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
