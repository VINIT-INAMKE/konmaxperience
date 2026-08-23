import { Prisma } from '@prisma/client';

/**
 * An integer number of paise (1/100 of a rupee).
 *
 * Every arithmetic step in the checkout path runs on `Paise`; `Prisma.Decimal`
 * appears only at the database boundary (`toPaise` on the way in, `toDecimal`
 * on the way out). `Number.MAX_SAFE_INTEGER` paise is ≈ ₹90 trillion, so the
 * integer domain is never the limiting factor — but every helper still asserts
 * the invariant rather than trusting it, because a single fractional or
 * non-finite value silently poisons an order total.
 */
export type Paise = number;

/**
 * Anything that can be read as a rupee amount or a percentage: the `Decimal`
 * Prisma hands back from a `Decimal(12,2)` column, a literal number, or the
 * string form used in fixtures and JSON settings.
 */
export type Money = Prisma.Decimal | number | string;

const HALF_UP = Prisma.Decimal.ROUND_HALF_UP;
const PAISE_PER_RUPEE = 100;
const PERCENT_BASE = 100;

/**
 * `new Prisma.Decimal(x)` throws on garbage strings but happily accepts `NaN`
 * and `Infinity` — both of which would propagate through `.toNumber()` into an
 * order total. Normalise the two failure modes into one loud error.
 */
function toFiniteDecimal(value: Money, label: string): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new TypeError(`${label} is not a numeric value: ${String(value)}`);
  }
  if (!decimal.isFinite()) {
    throw new TypeError(
      `${label} must be a finite value, received ${decimal.toString()}`,
    );
  }
  return decimal;
}

/**
 * Collapses `-0` to `0`. Rounding a small negative rupee value towards zero
 * yields IEEE negative zero, which is invisible in arithmetic but survives into
 * `Object.is`, `JSON.stringify` round-trips and `Decimal#toFixed` (`'-0.00'`).
 * No money value is ever negative zero.
 */
function zeroSafe(value: Paise): Paise {
  return value === 0 ? 0 : value;
}

/** Asserts the integer-paise invariant. Sign-agnostic: refunds and adjustments are negative. */
function assertPaise(value: Paise, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `${label} must be a safe integer number of paise, received ${String(value)}`,
    );
  }
}

/** Asserts an amount that can never legitimately be negative — a gross, a base, a subtotal. */
function assertNonNegativePaise(value: Paise, label: string): void {
  assertPaise(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must not be negative, received ${value}`);
  }
}

/**
 * Rupees -> integer paise, rounded half-up (ties away from zero, so `-0.005`
 * becomes `-1` exactly as `0.005` becomes `1`).
 *
 * This is the *only* door into the money domain: no `Number` multiplication or
 * division ever touches a rupee value (SPEC §10 DoD). Negative inputs are
 * allowed — refunds, credit notes and negative channel price modifiers are all
 * real (`exports/builders/products.builder.ts` formats them with a sign).
 */
export function toPaise(rupees: Money): Paise {
  const paise = toFiniteDecimal(rupees, 'rupees')
    .mul(PAISE_PER_RUPEE)
    .toDecimalPlaces(0, HALF_UP)
    .toNumber();
  assertPaise(paise, 'rupees converted to paise');
  return zeroSafe(paise);
}

/**
 * Integer paise -> the 2dp `Decimal` Prisma stores in a `Decimal(12,2)` column.
 *
 * The division by 100 always terminates, so the result is exact; the explicit
 * `toDecimalPlaces(2)` exists so the value Prisma writes and the value a test
 * compares are the same scale.
 */
export function toDecimal(paise: Paise): Prisma.Decimal {
  assertPaise(paise, 'paise');
  return new Prisma.Decimal(zeroSafe(paise))
    .div(PAISE_PER_RUPEE)
    .toDecimalPlaces(2, HALF_UP);
}

/**
 * GST is **inclusive** (SPEC §3.3): the listed price already contains the tax,
 * so the tax is carved *out* of the gross rather than added on top —
 * `tax = gross × rate / (100 + rate)`.
 *
 * The caller keeps `gross` as the line total and treats the result as
 * informational: `Order.subtotal` is the gross sum, `Order.tax_amount` is the
 * tax already contained in it, and `total = subtotal − discount + shipping`.
 * `tax_amount` is never added to `total`.
 *
 * A rate of exactly 0 carves nothing. A negative rate is corrupt data — it
 * would inflate the taxable base — and throws rather than silently returning 0.
 */
export function inclusiveTaxPaise(
  grossPaise: Paise,
  ratePercent: Money,
): Paise {
  assertNonNegativePaise(grossPaise, 'grossPaise');
  const rate = toFiniteDecimal(ratePercent, 'ratePercent');
  if (rate.isNegative()) {
    throw new RangeError(
      `ratePercent must not be negative, received ${rate.toString()}`,
    );
  }
  if (rate.isZero()) return 0;
  return zeroSafe(
    new Prisma.Decimal(grossPaise)
      .mul(rate)
      .div(rate.plus(PERCENT_BASE))
      .toDecimalPlaces(0, HALF_UP)
      .toNumber(),
  );
}

/**
 * `basePaise × percent / 100`, rounded half-up to whole paise.
 *
 * The base is an amount and can never be negative; the percentage can be —
 * a channel price modifier of `-10` is a 10% channel discount — so the result
 * may be negative and the caller decides how to apply it.
 */
export function percentOfPaise(basePaise: Paise, percent: Money): Paise {
  assertNonNegativePaise(basePaise, 'basePaise');
  const pct = toFiniteDecimal(percent, 'percent');
  if (pct.isZero()) return 0;
  return zeroSafe(
    new Prisma.Decimal(basePaise)
      .mul(pct)
      .div(PERCENT_BASE)
      .toDecimalPlaces(0, HALF_UP)
      .toNumber(),
  );
}

/** Total over integer paise; `[]` sums to 0. Every element and the result stay safe integers. */
export function sumPaise(values: readonly Paise[]): Paise {
  let total = 0;
  for (let i = 0; i < values.length; i += 1) {
    assertPaise(values[i], `values[${i}]`);
    total += values[i];
  }
  assertPaise(total, 'sum of values');
  return zeroSafe(total);
}

/**
 * Confines a value to `[min, max]` — the shape every cap in the phase takes
 * (coupon `max_discount`, loyalty `max_redeem_percent`, "never below zero").
 */
export function clampPaise(value: Paise, min: Paise, max: Paise): Paise {
  assertPaise(value, 'value');
  assertPaise(min, 'min');
  assertPaise(max, 'max');
  if (min > max) {
    throw new RangeError(`min (${min}) must not exceed max (${max})`);
  }
  return zeroSafe(Math.min(Math.max(value, min), max));
}
