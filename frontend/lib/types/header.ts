/**
 * SPEC §6.1 — the persistent mission header contract.
 *
 * These interfaces mirror `backend/src/me/me.service.ts` **exactly**. The header
 * renders nine slots and must never cost nine round trips, so `GET /me/header`
 * is a single aggregate and this file is its only front-end shape.
 *
 * Routes:
 *   GET /me/header       → HeaderContext
 *   GET /search?q=&limit= → SearchResults   (⌘K corpus)
 */

export interface HeaderUser {
  id: string;
  name: string;
  email: string;
  streak_days: number;
}

export interface HeaderRole {
  /** `RoleCode` value — display names live in `lib/types/roles.ts`. */
  code: string;
  name: string;
}

export interface HeaderNode {
  id: string;
  code: string;
  name: string;
  timezone: string;
  currency: string;
  status: string;
}

export interface HeaderMission {
  id: string;
  title: string;
  /** Prisma `MissionPhase` — `setup` | `foundation` | `activation` | `scale`. */
  phase: string;
  status: string;
}

export interface HeaderQuest {
  id: string;
  title: string;
  week_number: number;
  progress_percent: number;
  /** `false` when this is the node's quest shown because the caller has none. */
  mine: boolean;
}

export interface HeaderContext {
  user: HeaderUser | null;
  role: HeaderRole | null;
  node: HeaderNode | null;
  /** SPEC §6.3 module visibility — the same list `GET /modules/mine` returns. */
  module_keys: string[];
  mission: HeaderMission | null;
  quest: HeaderQuest | null;
  readiness_percent: number | null;
  approvals_waiting: number;
  notifications_unread: number;
  my_blockers: number;
  xp_total: number;
  level: number;
  /** True when the caller may start a mission — drives the §6.1 empty-state CTA. */
  can_create_mission: boolean;
}

/**
 * SPEC §6.1: "Never `null`." When `/me/header` has not answered — or has failed —
 * the header still renders a full row from this value rather than collapsing,
 * so a navigation never reflows and a degraded API never blanks the chrome.
 */
export const EMPTY_HEADER_CONTEXT: HeaderContext = {
  user: null,
  role: null,
  node: null,
  module_keys: [],
  mission: null,
  quest: null,
  readiness_percent: null,
  approvals_waiting: 0,
  notifications_unread: 0,
  my_blockers: 0,
  xp_total: 0,
  level: 1,
  can_create_mission: false,
};

// ── ⌘K search (GET /search) ────────────────────────────────────────────────

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  /** Ready-to-push app route; the palette never builds hrefs itself. */
  href: string;
}

export interface SearchResults {
  tasks: SearchHit[];
  products: SearchHit[];
  recipes: SearchHit[];
  guides: SearchHit[];
}

/** The four buckets `GET /search` returns, in the order the palette lists them. */
export type SearchBucket = keyof SearchResults;
