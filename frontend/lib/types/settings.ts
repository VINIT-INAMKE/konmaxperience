/**
 * `SystemSetting.value` is a Prisma `Json` column (SPEC §3.1), not a string.
 *
 * `GET /settings/:key` returns the raw row — `value` comes back as real JSON
 * (boolean, string, number, array or object). `PATCH /settings/:key` takes
 * `{ value: <json> }` and stores it verbatim, so booleans must be sent as
 * `true`/`false`, never as `'true'`/`'false'`.
 *
 * The key set is allow-listed by the backend (`SETTING_DEFAULTS` in
 * `settings.service.ts`); an unknown key is a 400.
 */

/** Prisma `ShippingProvider` — the provider half of the `shipping` setting. */
export type ShippingProviderSetting = 'shiprocket' | 'manual';

export interface XpRulesSetting {
  core: number;
  adhoc: number;
  improvement: number;
  level_curve: number[];
}

export interface ShippingSetting {
  provider: ShippingProviderSetting;
  pickup_location_code: string;
  default_weight_grams: number;
  default_dimensions_cm: { length: number; breadth: number; height: number };
}

export interface LoyaltySetting {
  /** Points earned per ₹100 of net order value (subtotal − discount). */
  earn_rate_per_100: number;
  /** Rupee value of one point at redemption — `0.25` means four points to the rupee. */
  redeem_value_per_point: number;
  /** Points expire this many days after they are earned. */
  expiry_days: number;
  /** Hard ceiling on the share of a subtotal a redemption may cover, as a percentage. */
  max_redeem_percent: number;
  /** Point thresholds keyed by Prisma `LoyaltyTier`. */
  tiers: { member: number; regular: number; insider: number };
}

export interface ReviewsSetting {
  /** A review at or above this rating publishes without moderation. */
  auto_publish_min_rating: number;
  /** Delay between an order being delivered and its review invitation. */
  invitation_delay_hours: number;
}

export interface PromotionsSetting {
  /** When false, at most one coupon may apply to an order (`PROMO-02` ships `false`). */
  allow_stacking: boolean;
}

/** SPEC §4.3 — the SALES and QUALITY readiness formulas. */
export interface ReadinessSetting {
  /** Trailing window for both formulas. */
  trailing_days: number;
  /** SALES: points per channel with at least one completed order in the window. */
  sales_points_per_channel: number;
  /** SALES: flat bonus once the window carries at least this many completed orders. */
  sales_volume_threshold: number;
  sales_volume_bonus: number;
  /** QUALITY: multiplier applied to `waste_cost / COGS` before the 0–100 clamp. */
  quality_waste_multiplier: number;
  /** History API default and hard cap, in days. */
  history_default_days: number;
  history_max_days: number;
}

/**
 * Every allow-listed settings key mapped to the JSON shape it holds.
 * All eleven keys mirror `SETTING_DEFAULTS` in
 * `backend/src/settings/settings.service.ts` one for one.
 */
export interface SettingValueMap {
  leaderboard_enabled: boolean;
  system_name: string;
  maintenance_mode: boolean;
  marketplace_fulfilment_zone_id: string | null;
  xp_rules: XpRulesSetting;
  delivery_pincodes: string[];
  shipping: ShippingSetting;
  loyalty: LoyaltySetting;
  reviews: ReviewsSetting;
  promotions: PromotionsSetting;
  readiness: ReadinessSetting;
}

export type SettingKey = keyof SettingValueMap;

export const SETTING_KEYS: SettingKey[] = [
  'leaderboard_enabled',
  'system_name',
  'maintenance_mode',
  'marketplace_fulfilment_zone_id',
  'xp_rules',
  'delivery_pincodes',
  'shipping',
  'loyalty',
  'reviews',
  'promotions',
  'readiness',
];

/** Mirrors the backend's `SETTING_DEFAULTS`; used when a row has not been written yet. */
export const SETTING_DEFAULTS: SettingValueMap = {
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
};

/** A row from `GET /settings/:key`. */
export interface SystemSetting<K extends SettingKey = SettingKey> {
  key: K;
  value: SettingValueMap[K];
  updated_at: string;
}

/** Body for `PATCH /settings/:key` — the value is sent as JSON, not stringified. */
export interface UpdateSettingPayload<K extends SettingKey = SettingKey> {
  value: SettingValueMap[K];
}

export const SETTING_LABELS: Record<SettingKey, string> = {
  leaderboard_enabled: 'Enable Leaderboard',
  system_name: 'System Name',
  maintenance_mode: 'Maintenance Mode',
  marketplace_fulfilment_zone_id: 'Marketplace Fulfilment Zone',
  xp_rules: 'XP Rules',
  delivery_pincodes: 'Delivery Pincodes',
  shipping: 'Shipping',
  loyalty: 'Loyalty',
  reviews: 'Reviews',
  promotions: 'Promotions',
  readiness: 'Readiness',
};

/**
 * Reads a setting value, falling back to the declared default when the row is
 * missing or holds `null`. Tolerates a legacy stringified boolean so a database
 * written before the Json migration still renders correctly.
 */
export function readSetting<K extends SettingKey>(
  key: K,
  setting: { value?: unknown } | undefined | null,
): SettingValueMap[K] {
  const raw = setting?.value;
  if (raw === undefined || raw === null) return SETTING_DEFAULTS[key];
  if (typeof SETTING_DEFAULTS[key] === 'boolean' && typeof raw === 'string') {
    return (raw === 'true') as SettingValueMap[K];
  }
  return raw as SettingValueMap[K];
}
