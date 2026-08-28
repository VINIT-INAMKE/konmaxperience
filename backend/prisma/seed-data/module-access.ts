import { RoleCode } from '../../src/types/roles';

const R = RoleCode;

/** Every seeded role code, in declaration order. Resolves `role_codes: 'ALL'`. */
export const ALL_ROLES: string[] = Object.values(RoleCode);

export interface ModuleAccessSeed {
  module_key: string;
  /**
   * Literal role codes, or a marker resolved at seed time:
   * - `'ALL'`       → every code in {@link ALL_ROLES}
   * - `'APPROVERS'` → every role holding `Permission.APPROVE_EVIDENCE` (SPEC §6.3)
   */
  role_codes: string[] | 'ALL' | 'APPROVERS';
  sort_order: number;
}

/**
 * SPEC §6.3 seeded module access defaults, editable at `/admin/modules` by any
 * holder of `MANAGE_SYSTEM`. `ModuleAccess` is global (no `node_id`).
 *
 * `sort_order` follows the SPEC §6.2 navigation spine (10..100), then the
 * collapsible groups in spine order: Kitchen (200), Procurement (300),
 * Commerce (400), Catalog & Experiences (500), Intelligence (600), Admin (700),
 * and finally the v2.1 Talent module (800).
 */
export const MODULE_ACCESS: ModuleAccessSeed[] = [
  { module_key: 'mission_control', role_codes: 'ALL', sort_order: 10 },
  { module_key: 'my_tasks', role_codes: 'ALL', sort_order: 20 },
  { module_key: 'my_quests', role_codes: 'ALL', sort_order: 30 },
  { module_key: 'evidence', role_codes: 'ALL', sort_order: 40 },
  { module_key: 'approvals', role_codes: 'APPROVERS', sort_order: 50 },
  { module_key: 'decisions', role_codes: 'ALL', sort_order: 60 },
  { module_key: 'readiness', role_codes: 'ALL', sort_order: 70 },
  { module_key: 'team', role_codes: 'ALL', sort_order: 80 },
  { module_key: 'guide', role_codes: 'ALL', sort_order: 90 },
  { module_key: 'chat', role_codes: 'ALL', sort_order: 100 },

  // Kitchen
  ...[
    'recipes',
    'ingredients',
    'prep_batches',
    'kds',
    'pick_pack',
    'waste',
    'supply_usage',
  ].map((k, i) => ({
    module_key: k,
    role_codes: [
      R.BACKEND_LEAD,
      R.PROCUREMENT_LEAD,
      R.FRONTEND_LEAD,
      R.FOUNDER_ADMIN,
      R.TECH_LEAD,
    ] as string[],
    sort_order: 200 + i,
  })),

  // Procurement
  ...['inventory', 'procurement', 'purchase_orders', 'vendors'].map((k, i) => ({
    module_key: k,
    role_codes: [
      R.PROCUREMENT_LEAD,
      R.BACKEND_LEAD,
      R.FOUNDER_ADMIN,
      R.TECH_LEAD,
    ] as string[],
    sort_order: 300 + i,
  })),

  // Commerce
  ...[
    'pos',
    'orders',
    'delivery',
    'shipments',
    'customers',
    'reviews',
    'daily_close',
  ].map((k, i) => ({
    module_key: k,
    role_codes: [R.FRONTEND_LEAD, R.FOUNDER_ADMIN, R.TECH_LEAD] as string[],
    sort_order: 400 + i,
  })),

  // Catalog & Experiences
  ...['catalog', 'promotions', 'experiences', 'brands', 'assets'].map(
    (k, i) => ({
      module_key: k,
      role_codes: [
        R.DESIGN_OUTREACH_LEAD,
        R.FRONTEND_LEAD,
        R.FOUNDER_ADMIN,
        R.TECH_LEAD,
      ] as string[],
      sort_order: 500 + i,
    }),
  ),

  // Intelligence
  ...['analytics', 'kpis', 'feedback', 'exports'].map((k, i) => ({
    module_key: k,
    role_codes: [R.BI_LEAD, R.FOUNDER_ADMIN, R.TECH_LEAD] as string[],
    sort_order: 600 + i,
  })),

  // Admin
  ...[
    'imports',
    'users',
    'permissions',
    'delegations',
    'notices',
    'settings',
    'modules',
    'guide_editor',
    'zones',
    'channels',
    // RUN-04's `/admin/usage` dashboard. Its own key rather than a corner of
    // `settings`, so it can be revoked without revoking system settings.
    'usage',
  ].map((k, i) => ({
    module_key: k,
    role_codes: [R.FOUNDER_ADMIN, R.TECH_LEAD] as string[],
    sort_order: 700 + i,
  })),

  // Talent (team readiness, onboarding checklist — v2.1)
  {
    module_key: 'talent',
    role_codes: [R.TALENT_LEAD, R.FOUNDER_ADMIN] as string[],
    sort_order: 800,
  },
];

/** Resolves the `'ALL'` / `'APPROVERS'` markers into concrete role codes. */
export function resolveModuleRoleCodes(
  seed: ModuleAccessSeed,
  approverRoleCodes: string[],
): string[] {
  if (seed.role_codes === 'ALL') return [...ALL_ROLES];
  if (seed.role_codes === 'APPROVERS') return [...approverRoleCodes];
  return [...seed.role_codes];
}
