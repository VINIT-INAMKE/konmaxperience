/**
 * Data-driven module visibility (SPEC §6.3), served by the backend
 * `module-access` module. Separate from the permission set: a role may hold
 * MANAGE_KITCHEN without seeing every kitchen page.
 *
 * Routes:
 *   GET   /modules        → ModuleAccess[]   (all rows, sort_order then key)
 *   GET   /modules/mine   → string[]         (module keys visible to the caller's role)
 *   PATCH /modules/:key   → ModuleAccess     (body: UpdateModuleAccessPayload)
 *
 * P4 builds the admin screen; these types exist so callers share one contract.
 */

/**
 * `ModuleAccess.module_key` is a free-form primary key on the backend — the row
 * set is seeded, not enum-constrained — so it stays a plain string here.
 */
export type ModuleKey = string;

export interface ModuleAccess {
  module_key: ModuleKey;
  /** `RoleCode` values allowed to see this module; empty means nobody. */
  role_codes: string[];
  enabled: boolean;
  sort_order: number;
  updated_at: string;
}

/** Body for `PATCH /modules/:key` — every field is optional (partial update). */
export interface UpdateModuleAccessPayload {
  role_codes?: string[];
  enabled?: boolean;
  sort_order?: number;
}

/** `GET /modules/mine` returns bare module keys, already ordered by sort_order. */
export type MyModuleKeys = ModuleKey[];

/**
 * Title-cases a `module_key` (`prep_batches` → `Prep Batches`) so a key with no
 * curated label still renders as something readable.
 */
export function moduleKeyLabel(key: ModuleKey): string {
  return key
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
