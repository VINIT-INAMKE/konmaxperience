// `SETTING_DEFAULTS` lives on `SettingsService`, which is a Nest `@Injectable`
// and therefore cannot be imported for its *value* from a plain `ts-node` seed
// (it would pull in `@nestjs/common`, `PrismaService` and `reflect-metadata`).
// The table is mirrored here instead; the `import type` below is erased at
// runtime but makes tsc reject any key drift, and
// `src/prisma/seed-data.spec.ts` asserts the two are deeply equal.
import type { SETTING_DEFAULTS } from '../../src/settings/settings.service';

/**
 * Mirror of `SETTING_DEFAULTS` (`src/settings/settings.service.ts`).
 * `SystemSetting.value` is `Json` (SPEC §3.1), so these are seeded as real JSON
 * values — booleans, strings, arrays and objects — never stringified.
 */
export const SEED_SETTING_DEFAULTS: typeof SETTING_DEFAULTS = {
  leaderboard_enabled: true,
  system_name: 'Konma Xperience OS',
  maintenance_mode: false,
  marketplace_fulfilment_zone_id: null,
  xp_rules: {
    core: 1.0,
    adhoc: 0.7,
    improvement: 0.8,
    level_curve: [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000],
  },
  delivery_pincodes: [],
  shipping: {
    provider: 'manual',
    pickup_location_code: '',
    default_weight_grams: 500,
    default_dimensions_cm: { length: 20, breadth: 15, height: 10 },
  },
  loyalty: {
    earn_rate_per_100: 5,
    redeem_value_per_point: 0.25,
    expiry_days: 365,
    max_redeem_percent: 20,
    tiers: { member: 0, regular: 500, insider: 2000 },
  },
  reviews: {
    auto_publish_min_rating: 4,
    invitation_delay_hours: 24,
  },
  promotions: {
    allow_stacking: false,
  },
  readiness: {
    trailing_days: 7,
    sales_points_per_channel: 25,
    sales_volume_threshold: 10,
    sales_volume_bonus: 10,
    quality_waste_multiplier: 5,
    history_default_days: 90,
    history_max_days: 365,
  },
  notifications: {
    whatsapp_enabled: false,
    quiet_hours: { start: '21:00', end: '07:00' },
    cooldown_hours: {
      approval_pending: 24,
      task_blocked: 12,
      low_stock: 4,
      shipment_failed: 6,
      morning_brief: 20,
      daily_close_due: 20,
    },
    email_types: ['task_due', 'task_blocked', 'approval_pending', 'low_stock'],
  },
  ai: {
    provider: 'heuristic',
    model: 'claude-opus-5',
    evidence_assist_enabled: true,
    morning_brief_enabled: true,
    morning_brief_role_codes: [
      'FOUNDER_ADMIN',
      'BACKEND_LEAD',
      'FRONTEND_LEAD',
      'BI_LEAD',
      'PROCUREMENT_LEAD',
    ],
  },
  daily_close: {
    compute_at: '00:45',
    signer_role_codes: ['FRONTEND_LEAD', 'FOUNDER_ADMIN'],
  },
};

export type SeedSettingKey = keyof typeof SEED_SETTING_DEFAULTS;

export const SEED_SETTING_KEYS = Object.keys(
  SEED_SETTING_DEFAULTS,
) as SeedSettingKey[];
