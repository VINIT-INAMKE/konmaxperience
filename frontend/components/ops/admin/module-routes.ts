/**
 * Presentation metadata for the `/admin/modules` editor.
 *
 * `ModuleAccess` rows are seeded, not enum-constrained (see
 * `backend/prisma/seed-data/module-access.ts`), so the editor needs three things
 * the API does not send: a readable label, the screen a key maps to, and the
 * `sort_order` band the seed groups it under.
 *
 * `frontend/lib/nav/spine.ts` is the shipping source of truth for the
 * navigation spine and is built in the same wave as this screen. Once it lands,
 * {@link MODULE_ROUTES} and {@link PRIMARY_MODULE_KEYS} should be derived from
 * it rather than duplicated here — this file is deliberately data-only so that
 * swap is a one-line change.
 */

import { moduleKeyLabel, type ModuleKey } from '@/lib/types/modules';
import { RoleCode } from '@/lib/types/roles';

/**
 * Labels `moduleKeyLabel()` cannot get right — acronyms and ampersands. Every
 * other key falls through to the shared title-caser.
 */
const MODULE_LABEL_OVERRIDES: Readonly<Record<string, string>> = {
  kds: 'KDS',
  pos: 'POS',
  kpis: 'KPIs',
  pick_pack: 'Pick & Pack',
  guide_editor: 'Guide Editor',
  mission_control: 'Mission Control',
  purchase_orders: 'Purchase Orders',
  supply_usage: 'Supply Usage',
  prep_batches: 'Prep Batches',
};

/** Curated label for a module key, falling back to the shared title-caser. */
export function moduleLabel(key: ModuleKey): string {
  return MODULE_LABEL_OVERRIDES[key] ?? moduleKeyLabel(key);
}

/**
 * The screen each seeded key opens. Keys absent from this map have no route in
 * this release (`shipments`, `customers`, `reviews`, `promotions` ship with the
 * storefront phase; `talent` is v2.1) and render as "—" in the editor so a grant
 * can never produce a dead link.
 */
export const MODULE_ROUTES: Readonly<Record<string, string>> = {
  // Spine (SPEC §6.2)
  mission_control: '/dashboard',
  my_tasks: '/tasks',
  my_quests: '/quests?mine=1',
  evidence: '/boards/evidence',
  approvals: '/approvals',
  decisions: '/decisions',
  readiness: '/readiness',
  team: '/team',
  guide: '/guide',
  chat: '/chat',

  // Kitchen
  recipes: '/operations/recipes',
  ingredients: '/operations/ingredients',
  prep_batches: '/operations/kitchen/prep-batches',
  kds: '/operations/kitchen/kds',
  pick_pack: '/operations/kitchen/pick-and-pack',
  waste: '/operations/kitchen/waste',
  supply_usage: '/operations/kitchen/supply-usage',

  // Procurement
  inventory: '/operations/inventory',
  procurement: '/operations/procurement',
  purchase_orders: '/operations/purchase-orders',
  vendors: '/operations/vendors',

  // Commerce
  pos: '/pos',
  orders: '/pos/orders',
  delivery: '/pos/delivery',

  // Catalog & Experiences
  catalog: '/operations/menu',
  experiences: '/operations/events',
  brands: '/operations/brands',
  assets: '/operations/assets',

  // Intelligence
  analytics: '/intelligence/analytics',
  kpis: '/kpis',
  feedback: '/operations/feedback',
  exports: '/admin/exports',

  // Admin
  imports: '/admin/import',
  users: '/admin/users',
  permissions: '/admin/permissions',
  delegations: '/admin/delegations',
  notices: '/admin/notices',
  settings: '/admin/settings',
  modules: '/admin/modules',
  guide_editor: '/admin/guide',
  zones: '/operations/zones',
  channels: '/operations/channels',
};

/**
 * The fixed navigation spine (SPEC §6.2, `sort_order` 10–100). Disabling one of
 * these removes a top-level destination for every role, so the editor asks for
 * confirmation first.
 */
export const PRIMARY_MODULE_KEYS: readonly ModuleKey[] = [
  'mission_control',
  'my_tasks',
  'my_quests',
  'evidence',
  'approvals',
  'decisions',
  'readiness',
  'team',
  'guide',
  'chat',
];

export interface ModuleBand {
  /** Stable id, used as a React key and as the sticky heading anchor. */
  id: string;
  label: string;
  /** Inclusive `sort_order` bounds, matching the seed's numbering scheme. */
  min: number;
  max: number;
}

/** The `sort_order` bands the seed lays out, in spine order. */
export const MODULE_BANDS: readonly ModuleBand[] = [
  { id: 'spine', label: 'Navigation spine', min: 0, max: 199 },
  { id: 'kitchen', label: 'Kitchen', min: 200, max: 299 },
  { id: 'procurement', label: 'Procurement', min: 300, max: 399 },
  { id: 'commerce', label: 'Commerce', min: 400, max: 499 },
  { id: 'catalog', label: 'Catalog & Experiences', min: 500, max: 599 },
  { id: 'intelligence', label: 'Intelligence', min: 600, max: 699 },
  { id: 'admin', label: 'Admin', min: 700, max: 799 },
  { id: 'talent', label: 'Talent (v2.1)', min: 800, max: 899 },
];

/** Catches any row whose `sort_order` falls outside the seeded bands. */
export const OVERFLOW_BAND: ModuleBand = {
  id: 'other',
  label: 'Other',
  min: 900,
  max: Number.MAX_SAFE_INTEGER,
};

/** The band a `sort_order` belongs to; never `undefined`. */
export function bandForSortOrder(sortOrder: number): ModuleBand {
  return (
    MODULE_BANDS.find(
      (band) => sortOrder >= band.min && sortOrder <= band.max,
    ) ?? OVERFLOW_BAND
  );
}

/**
 * Column headings for the role matrix. The full name from `ROLE_DISPLAY_NAMES`
 * is too wide for a 47-row × 8-role grid, so the header shows the short form and
 * carries the full name in its tooltip and its `aria-label`.
 */
export const ROLE_SHORT_LABELS: Readonly<Record<RoleCode, string>> = {
  [RoleCode.FOUNDER_ADMIN]: 'Founder',
  [RoleCode.FRONTEND_LEAD]: 'Frontend',
  [RoleCode.BACKEND_LEAD]: 'Backend',
  [RoleCode.BI_LEAD]: 'BI',
  [RoleCode.PROCUREMENT_LEAD]: 'Procurement',
  [RoleCode.TALENT_LEAD]: 'Talent',
  [RoleCode.TECH_LEAD]: 'Tech',
  [RoleCode.DESIGN_OUTREACH_LEAD]: 'Design',
};
