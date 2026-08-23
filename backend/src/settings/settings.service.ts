import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Allow-listed settings keys with their defaults. `SystemSetting.value` is Json
 * (SPEC §3.1), so a key may hold a scalar, an object or an array; the default
 * doubles as the shape contract and as the fallback when the row is absent.
 */
export const SETTING_DEFAULTS = {
  leaderboard_enabled: true as boolean,
  system_name: 'Konma Xperience OS' as string,
  maintenance_mode: false as boolean,
  marketplace_fulfilment_zone_id: null as string | null,
  xp_rules: {
    core: 1.0,
    adhoc: 0.7,
    improvement: 0.8,
    level_curve: [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000],
  },
  delivery_pincodes: [] as string[],
  shipping: {
    provider: 'manual' as 'shiprocket' | 'manual',
    pickup_location_code: '',
    default_weight_grams: 500,
    default_dimensions_cm: { length: 20, breadth: 15, height: 10 },
  },
  loyalty: {
    /** Points earned per ₹100 of net order value (subtotal − discount). */
    earn_rate_per_100: 5,
    /** Rupee value of one point at redemption — 0.25 means 4 points = ₹1. */
    redeem_value_per_point: 0.25,
    /** Points expire this many days after they are earned. */
    expiry_days: 365,
    /** Hard ceiling on the share of a subtotal a redemption may cover. */
    max_redeem_percent: 20,
    tiers: { member: 0, regular: 500, insider: 2000 },
  },
  reviews: {
    /** A review at or above this rating publishes without moderation. */
    auto_publish_min_rating: 4,
    /** Delay between an order being delivered and its review invitation. */
    invitation_delay_hours: 24,
  },
  promotions: {
    /** When false, at most one coupon may apply to an order. */
    allow_stacking: false,
  },
  readiness: {
    /** SPEC §4.3 — trailing window for the SALES and QUALITY formulas. */
    trailing_days: 7,
    /** SALES: points per channel with >= 1 completed order in the window. */
    sales_points_per_channel: 25,
    /** SALES: flat bonus when the window carries >= this many completed orders. */
    sales_volume_threshold: 10,
    sales_volume_bonus: 10,
    /** QUALITY: multiplier applied to waste_cost / COGS before the 0-100 clamp. */
    quality_waste_multiplier: 5,
    /** History API default and hard cap. */
    history_default_days: 90,
    history_max_days: 365,
  },
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

/** A JSON block setting — not an array, not a scalar, not null. */
function isBlock(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateKey(key: string): asserts key is SettingKey {
    if (!SETTING_KEYS.includes(key as SettingKey)) {
      throw new BadRequestException(
        `Invalid setting key: ${key}. Allowed: ${SETTING_KEYS.join(', ')}`,
      );
    }
  }

  /** Typed read with the declared default as fallback — never throws on a missing row. */
  async get<K extends SettingKey>(
    key: K,
  ): Promise<(typeof SETTING_DEFAULTS)[K]> {
    this.validateKey(key);
    const fallback = SETTING_DEFAULTS[key];
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!row || row.value === null) return fallback;
    // A block setting grows keys over time (`loyalty` gained `expiry_days` and
    // `max_redeem_percent` in P5a), and `seed-reference.ts` deliberately never
    // rewrites a row an operator may have edited. Layer the stored block over
    // the declared default so a row written before a key existed still answers
    // for it — the alternative is `undefined` reaching the money path, where
    // the paise helpers reject it and the request 500s. Shallow by design: a
    // nested block (`loyalty.tiers`) is replaced wholesale, not merged.
    // `fallback` is a generic indexed access, which a type guard cannot narrow
    // in place; widen to `unknown` first so the guard does the work.
    const declared: unknown = fallback;
    const stored: unknown = row.value;
    if (isBlock(declared) && isBlock(stored)) {
      return { ...declared, ...stored } as (typeof SETTING_DEFAULTS)[K];
    }
    return row.value as (typeof SETTING_DEFAULTS)[K];
  }

  /** Raw row read for the admin screen; still throws when the row is absent. */
  async getSetting(key: string) {
    this.validateKey(key);
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    return setting;
  }

  async updateSetting(key: string, value: Prisma.InputJsonValue) {
    this.validateKey(key);
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
