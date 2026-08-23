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
  earn_rate_per_100: number;
  redeem_value_per_point: number;
  /** Point thresholds keyed by Prisma `LoyaltyTier`. */
  tiers: { member: number; regular: number; insider: number };
}

/** Every allow-listed settings key mapped to the JSON shape it holds. */
export interface SettingValueMap {
  leaderboard_enabled: boolean;
  system_name: string;
  maintenance_mode: boolean;
  marketplace_fulfilment_zone_id: string | null;
  xp_rules: XpRulesSetting;
  delivery_pincodes: string[];
  shipping: ShippingSetting;
  loyalty: LoyaltySetting;
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
    tiers: { member: 0, regular: 500, insider: 2000 },
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
