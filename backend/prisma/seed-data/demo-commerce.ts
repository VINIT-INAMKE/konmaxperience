import type { CouponType, CouponStatus, ProductType } from '@prisma/client';

export interface DemoCouponSeed {
  code: string;
  description: string;
  type: CouponType;
  value: number;
  min_order: number | null;
  max_discount: number | null;
  applies_to: ProductType[];
  /** Days from the seed run; the seed converts to absolute timestamps. */
  starts_in_days: number;
  ends_in_days: number;
  usage_limit: number | null;
  per_customer_limit: number | null;
  status: CouponStatus;
}

export const DEMO_COUPONS: DemoCouponSeed[] = [
  {
    code: 'WELCOME10',
    description: '10% off your first Konma order',
    type: 'percent',
    value: 10,
    min_order: 500,
    max_discount: 200,
    applies_to: [],
    starts_in_days: -1,
    ends_in_days: 90,
    usage_limit: 500,
    per_customer_limit: 1,
    status: 'active',
  },
  {
    code: 'PANTRY150',
    description: '₹150 off packaged pantry goods',
    type: 'fixed',
    value: 150,
    min_order: 900,
    max_discount: null,
    applies_to: ['packaged'],
    starts_in_days: -1,
    ends_in_days: 60,
    usage_limit: 200,
    per_customer_limit: 2,
    status: 'active',
  },
  {
    code: 'SHIPFREE',
    description: 'Free shipping on packaged and merchandise orders',
    type: 'free_shipping',
    value: 0,
    min_order: 1200,
    max_discount: null,
    applies_to: ['packaged', 'merchandise'],
    starts_in_days: -1,
    ends_in_days: 30,
    usage_limit: null,
    per_customer_limit: 3,
    status: 'active',
  },
  {
    code: 'EXPIRED5',
    description: 'Expired coupon — proves the validity window is enforced',
    type: 'percent',
    value: 5,
    min_order: null,
    max_discount: null,
    applies_to: [],
    starts_in_days: -60,
    ends_in_days: -30,
    usage_limit: null,
    per_customer_limit: null,
    status: 'active',
  },
];

/**
 * One demo customer with a loyalty balance, so the redeem path is walkable
 * end-to-end.
 *
 * The phone is the **10-digit national** number, not the `91`-prefixed form the
 * plan's fixture used: `SendOtpDto`/`VerifyOtpDto` validate `/^[6-9]\d{9}$/`,
 * `CustomerAuthService.verifyOtp` upserts `Customer.phone` with exactly the
 * string it was given, and `WhatsAppService.normalize()` adds the `91` prefix on
 * the way out. A `91…` seed row can therefore never be logged into.
 */
export const DEMO_LOYALTY_CUSTOMER = {
  phone: '9900000001',
  name: 'Demo Customer',
  email: 'demo.customer@konma.store',
  points_balance: 620,
  lifetime_points: 620,
  tier: 'regular' as const,
};

/**
 * A default delivery address for the demo customer, so
 * `POST /customer/checkout/quote` has a `delivery_address_id` to quote against.
 *
 * The pincode is one of the values in this repo's local `.env`
 * `DELIVERY_PINCODES`: `SystemSetting['delivery_pincodes']` seeds empty, and
 * `ServiceabilityService.allowedPincodes()` then falls back to that env var, so a
 * demo address outside the configured list fails the local-line serviceability
 * guard. Widen `delivery_pincodes` (or the env var) to seed a different city.
 */
export const DEMO_CUSTOMER_ADDRESS = {
  label: 'Home',
  address: '12 Thoraipakkam OMR, Chennai',
  landmark: 'Opposite the water tank',
  pincode: '600096',
  is_default: true,
};
