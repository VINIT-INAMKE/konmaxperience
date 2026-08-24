/**
 * The deployment's operating node (SPEC §1.2). v2.0 runs exactly one node, so
 * the API exposes it as a singleton rather than a collection.
 *
 * Routes:
 *   GET   /nodes/current → Node
 *   PATCH /nodes/current → Node (body: UpdateNodePayload; MANAGE_SYSTEM)
 *
 * P4 builds the admin screen; these types exist so callers share one contract.
 */

/** Prisma `NodeStatus`. */
export type NodeStatus = 'setup' | 'active' | 'paused' | 'closed';

export const NODE_STATUSES: NodeStatus[] = ['setup', 'active', 'paused', 'closed'];

export const NODE_STATUS_LABELS: Record<NodeStatus, string> = {
  setup: 'Setup',
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
};

/**
 * Token classes for the read-only status pill on `/admin/node`.
 *
 * Task 19 re-tokenised this map (it held raw `blue-500` / `green-500` /
 * `amber-500` classes and had zero call sites, so no sweep ever reached it) and
 * folded `NodeSettingsForm`'s private duplicate into it, so the mapping now
 * exists exactly once.
 */
export const NODE_STATUS_BADGE_CLASSES: Record<NodeStatus, string> = {
  setup: 'bg-info-status/12 text-info-status',
  active: 'bg-good/12 text-good',
  paused: 'bg-warning/12 text-warning',
  closed: 'bg-surface-raised text-ink-muted',
};

export interface Node {
  id: string;
  /** Stable short code, unique across nodes. */
  code: string;
  name: string;
  /** IANA zone id, e.g. `Asia/Kolkata`. */
  timezone: string;
  /** ISO 4217 alphabetic code, e.g. `INR`. */
  currency: string;
  status: NodeStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Body for `PATCH /nodes/current`. `code` and `status` are not editable through
 * this route — the backend DTO accepts name, timezone and currency only.
 */
export interface UpdateNodePayload {
  name?: string;
  timezone?: string;
  /** Must be exactly 3 characters. */
  currency?: string;
}
