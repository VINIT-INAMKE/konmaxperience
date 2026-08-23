/**
 * `IA-04` — the paginated `GET /tasks` envelope plus the URL-search-param →
 * query-string mapping that `/tasks` is built on.
 *
 * The filter state lives in the URL and nowhere else, so a filtered board is
 * linkable and the browser back button restores the previous filter set. This
 * module is the single place that decides which of those params the API
 * understands and which are narrowed in the browser.
 */

import { RoleCode } from '@/lib/types/roles';
import type { Task, TaskPriority, TaskStatus, TaskType } from '@/lib/types/tasks';

/** Shape of `GET /tasks` when `cursor` or `limit` is supplied (backend Task 5). */
export interface TaskPage {
  items: Task[];
  next_cursor: string | null;
  has_more: boolean;
}

export const TASK_PAGE_SIZE = 50;

/**
 * URL params `GET /tasks` filters on **server-side**. `mine` is handled
 * separately because its default is role-derived, not "absent means off".
 */
export const TASK_SERVER_PARAMS = [
  'status',
  'quest_id',
  'mission_id',
  'task_type',
  'view_as',
] as const;

/**
 * URL params with no server-side filter. They narrow the rows already fetched,
 * which is why the filter bar labels them as narrowing the loaded set rather
 * than pretending they page the whole table.
 */
export const TASK_CLIENT_PARAMS = ['priority'] as const;

/** `mine` defaults **on** for every role except the two that watch everyone. */
const MINE_DEFAULT_OFF_ROLES: readonly string[] = [
  RoleCode.FOUNDER_ADMIN,
  RoleCode.TECH_LEAD,
];

export function defaultMineForRole(roleCode: string | undefined): boolean {
  return !MINE_DEFAULT_OFF_ROLES.includes(roleCode ?? '');
}

/** Whether the `mine` filter is on for this URL, falling back to the role default. */
export function isMineOn(
  params: URLSearchParams,
  roleCode: string | undefined,
): boolean {
  const raw = params.get('mine');
  if (raw === null) return defaultMineForRole(roleCode);
  return raw === '1' || raw === 'true';
}

const VALID_STATUSES: readonly TaskStatus[] = [
  'todo',
  'doing',
  'done',
  'blocked',
  'cancelled',
];
const VALID_TYPES: readonly TaskType[] = ['core', 'adhoc', 'improvement'];
const VALID_PRIORITIES: readonly TaskPriority[] = [
  'low',
  'medium',
  'high',
  'critical',
];

/**
 * The `status=` param, sanitised. The API 400s on an unknown enum value, so a
 * hand-edited or stale URL must never reach it.
 */
export function parseStatusParam(raw: string | null): TaskStatus[] {
  if (!raw) return [];
  const seen = new Set<TaskStatus>();
  for (const part of raw.split(',')) {
    const value = part.trim();
    if ((VALID_STATUSES as readonly string[]).includes(value)) {
      seen.add(value as TaskStatus);
    }
  }
  return [...seen];
}

export function parseTypeParam(raw: string | null): TaskType | null {
  return raw && (VALID_TYPES as readonly string[]).includes(raw)
    ? (raw as TaskType)
    : null;
}

export function parsePriorityParam(raw: string | null): TaskPriority | null {
  return raw && (VALID_PRIORITIES as readonly string[]).includes(raw)
    ? (raw as TaskPriority)
    : null;
}

/**
 * URL search params → the `GET /tasks` query string.
 *
 * | URL param    | API query    | Filtered by |
 * |--------------|--------------|-------------|
 * | `mine`       | `mine=1`     | server (absent → role default) |
 * | `status`     | `status=`    | server (comma-separated, enum-validated) |
 * | `quest_id`   | `quest_id=`  | server |
 * | `mission_id` | `mission_id=`| server |
 * | `task_type`  | `task_type=` | server |
 * | `view_as`    | `view_as=`   | server (admin only, ignored otherwise) |
 * | `priority`   | —            | browser, over the rows already loaded |
 * | `view`       | —            | not a filter (kanban/list, persisted locally) |
 */
export function buildTaskQuery(
  params: URLSearchParams,
  roleCode: string | undefined,
  opts: { cursor?: string; limit?: number } = {},
): string {
  const query = new URLSearchParams();

  const statuses = parseStatusParam(params.get('status'));
  if (statuses.length > 0) query.set('status', statuses.join(','));

  const taskType = parseTypeParam(params.get('task_type'));
  if (taskType) query.set('task_type', taskType);

  for (const key of ['quest_id', 'mission_id', 'view_as'] as const) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }

  if (isMineOn(params, roleCode)) query.set('mine', '1');

  // `limit` is always sent: it is what switches the endpoint from its legacy
  // unbounded array to the `{ items, next_cursor, has_more }` envelope.
  query.set('limit', String(opts.limit ?? TASK_PAGE_SIZE));
  if (opts.cursor) query.set('cursor', opts.cursor);

  return query.toString();
}

/** True when the URL carries any filter that is not just the role default. */
export function hasActiveTaskFilters(
  params: URLSearchParams,
  roleCode: string | undefined,
): boolean {
  if (parseStatusParam(params.get('status')).length > 0) return true;
  if (parseTypeParam(params.get('task_type'))) return true;
  if (parsePriorityParam(params.get('priority'))) return true;
  if (params.get('quest_id')) return true;
  if (params.get('mission_id')) return true;
  return isMineOn(params, roleCode) !== defaultMineForRole(roleCode);
}
