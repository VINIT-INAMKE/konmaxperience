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

export const NODE_STATUS_BADGE_CLASSES: Record<NodeStatus, string> = {
  setup: 'bg-blue-500/15 text-blue-400',
  active: 'bg-green-500/15 text-green-400',
  paused: 'bg-amber-500/15 text-amber-400',
  closed: 'bg-muted text-muted-foreground',
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
