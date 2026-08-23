import { Prisma } from '@prisma/client';
import {
  clampPaise,
  inclusiveTaxPaise,
  percentOfPaise,
  sumPaise,
  toDecimal,
  toPaise,
} from './money';

const dec = (v: string) => new Prisma.Decimal(v);

describe('money', () => {
  // ── toPaise ───────────────────────────────────────────────────────────────

  describe('toPaise', () => {
    it('converts rupees to paise with half-up rounding', () => {
      expect(toPaise('123.45')).toBe(12345);
      expect(toPaise(new Prisma.Decimal('0.005'))).toBe(1);
      expect(toPaise(0)).toBe(0);
    });

    it('accepts a string, a number and a Prisma.Decimal identically', () => {
      expect(toPaise('99.99')).toBe(9999);
      expect(toPaise(99.99)).toBe(9999);
      expect(toPaise(dec('99.99'))).toBe(9999);
    });

    it('rounds a half paise away from zero, in both directions', () => {
      expect(toPaise('0.014')).toBe(1);
      expect(toPaise('0.015')).toBe(2);
      expect(toPaise('0.005')).toBe(1);
      expect(toPaise('-0.005')).toBe(-1);
      expect(toPaise('-0.015')).toBe(-2);
      expect(toPaise('-0.004')).toBe(0);
    });

    it('never produces negative zero', () => {
      // `-0.004 × 100` rounds to IEEE `-0`, which survives into `toFixed` as
      // `'-0.00'` and breaks `Object.is` comparisons. No money value is `-0`.
      expect(Object.is(toPaise('-0.004'), 0)).toBe(true);
      expect(Object.is(toPaise(-0), 0)).toBe(true);
      expect(Object.is(percentOfPaise(1, '-0.4'), 0)).toBe(true);
      expect(Object.is(sumPaise([toPaise('-0.004')]), 0)).toBe(true);
      expect(Object.is(clampPaise(toPaise('-0.004'), -100, 100), 0)).toBe(true);
      expect(toDecimal(toPaise('-0.004')).toFixed(2)).toBe('0.00');
    });

    it('carries negative rupee values through — refunds and negative channel modifiers are real', () => {
      expect(toPaise('-123.45')).toBe(-12345);
      expect(toPaise(dec('-10'))).toBe(-1000);
    });

    it('never returns a fractional paise, whatever the input scale', () => {
      for (const input of ['0.001', '99.999', '1.005', '7.4999', '-3.3333']) {
        expect(Number.isInteger(toPaise(input))).toBe(true);
      }
      expect(toPaise('99.999')).toBe(10000);
    });

    it('rejects a non-numeric value', () => {
      expect(() => toPaise('abc')).toThrow(TypeError);
      expect(() => toPaise('')).toThrow(/not a numeric value|finite/);
      expect(() => toPaise('12.3.4')).toThrow(TypeError);
    });

    it('rejects NaN and Infinity rather than letting them reach a total', () => {
      expect(() => toPaise(NaN)).toThrow(TypeError);
      expect(() => toPaise(Infinity)).toThrow(/finite/);
      expect(() => toPaise(-Infinity)).toThrow(/finite/);
    });

    it('rejects a value too large to stay an exact integer of paise', () => {
      expect(() => toPaise('1e15')).toThrow(/safe integer/);
    });
  });

  // ── toDecimal ─────────────────────────────────────────────────────────────

  describe('toDecimal', () => {
    it('round-trips paise back to a 2dp Decimal', () => {
      expect(toDecimal(12345).toFixed(2)).toBe('123.45');
      expect(toDecimal(0).toFixed(2)).toBe('0.00');
    });

    it('returns a Prisma.Decimal at the scale the Decimal(12,2) column stores', () => {
      const value = toDecimal(5);
      expect(value).toBeInstanceOf(Prisma.Decimal);
      expect(value.toFixed(2)).toBe('0.05');
      expect(toDecimal(100).toFixed(2)).toBe('1.00');
      expect(toDecimal(-12345).toFixed(2)).toBe('-123.45');
    });

    it('round-trips rupees -> paise -> rupees without drift', () => {
      for (const rupees of ['0.00', '0.01', '12.34', '999.99', '-45.60']) {
        expect(toDecimal(toPaise(rupees)).toFixed(2)).toBe(
          dec(rupees).toFixed(2),
        );
      }
    });

    it('round-trips paise -> rupees -> paise without drift', () => {
      for (const paise of [0, 1, 99, 12345, -12345, 987654321]) {
        expect(toPaise(toDecimal(paise))).toBe(paise);
      }
    });

    it('rejects a fractional paise — the invariant it exists to protect', () => {
      expect(() => toDecimal(1.5)).toThrow(/safe integer/);
      expect(() => toDecimal(NaN)).toThrow(TypeError);
      expect(() => toDecimal(Number.MAX_SAFE_INTEGER + 2)).toThrow(
        /safe integer/,
      );
    });
  });

  // ── inclusiveTaxPaise ─────────────────────────────────────────────────────

  describe('inclusiveTaxPaise', () => {
    it('carves inclusive GST out of a gross amount', () => {
      // ₹105.00 gross at 5% inclusive -> ₹5.00 tax, ₹100.00 taxable
      expect(inclusiveTaxPaise(10500, 5)).toBe(500);
      // ₹112.00 gross at 12% inclusive -> ₹12.00 tax
      expect(inclusiveTaxPaise(11200, 12)).toBe(1200);
      expect(inclusiveTaxPaise(9999, 0)).toBe(0);
    });

    it('carves, never adds — the tax is already inside the gross', () => {
      const gross = 11800;
      const tax = inclusiveTaxPaise(gross, 18);
      expect(tax).toBe(1800);
      expect(gross - tax).toBe(10000); // taxable base
      expect(tax).toBeLessThan(gross);
    });

    it('keeps tax strictly inside the gross for every real GST slab', () => {
      for (const rate of [0, 5, 12, 18, 28]) {
        for (const gross of [0, 1, 99, 12345, 987654]) {
          const tax = inclusiveTaxPaise(gross, rate);
          expect(Number.isInteger(tax)).toBe(true);
          expect(tax).toBeGreaterThanOrEqual(0);
          expect(tax).toBeLessThanOrEqual(gross);
        }
      }
    });

    it('never returns a fractional paise', () => {
      expect(Number.isInteger(inclusiveTaxPaise(33333, 5))).toBe(true);
      expect(inclusiveTaxPaise(33333, 5)).toBe(1587); // 1587.2857… -> 1587
      expect(inclusiveTaxPaise(10000, '2.5')).toBe(244); // 243.902… -> 244
    });

    it('rounds a half paise away from zero', () => {
      expect(inclusiveTaxPaise(1, 100)).toBe(1); // 0.5 -> 1
      expect(inclusiveTaxPaise(3, 100)).toBe(2); // 1.5 -> 2
    });

    it('reads the rate from a number, a string or a Decimal alike', () => {
      expect(inclusiveTaxPaise(10500, 5)).toBe(500);
      expect(inclusiveTaxPaise(10500, '5')).toBe(500);
      expect(inclusiveTaxPaise(10500, dec('5.00'))).toBe(500);
    });

    it('carves nothing from a zero gross or a zero rate', () => {
      expect(inclusiveTaxPaise(0, 18)).toBe(0);
      expect(inclusiveTaxPaise(50000, 0)).toBe(0);
      expect(inclusiveTaxPaise(50000, dec('0.00'))).toBe(0);
    });

    it('rejects a negative gross — a line total is never negative', () => {
      expect(() => inclusiveTaxPaise(-10500, 5)).toThrow(RangeError);
      expect(() => inclusiveTaxPaise(-1, 5)).toThrow(/must not be negative/);
    });

    it('rejects a negative rate rather than silently inflating the taxable base', () => {
      expect(() => inclusiveTaxPaise(10500, -5)).toThrow(RangeError);
      expect(() => inclusiveTaxPaise(10500, '-0.01')).toThrow(
        /must not be negative/,
      );
    });

    it('rejects a fractional gross and a non-finite rate', () => {
      expect(() => inclusiveTaxPaise(105.5, 5)).toThrow(/safe integer/);
      expect(() => inclusiveTaxPaise(10500, NaN)).toThrow(TypeError);
      expect(() => inclusiveTaxPaise(10500, 'x')).toThrow(TypeError);
    });
  });

  // ── percentOfPaise ────────────────────────────────────────────────────────

  describe('percentOfPaise', () => {
    it('percentOfPaise rounds half-up', () => {
      expect(percentOfPaise(10000, 10)).toBe(1000);
      expect(percentOfPaise(1, 50)).toBe(1); // 0.5 -> 1
      expect(percentOfPaise(3, 50)).toBe(2); // 1.5 -> 2
    });

    it('never returns a fractional paise', () => {
      expect(Number.isInteger(percentOfPaise(33333, '17.5'))).toBe(true);
      expect(percentOfPaise(33333, '17.5')).toBe(5833); // 5833.275 -> 5833
      expect(percentOfPaise(10000, dec('12.5'))).toBe(1250);
    });

    it('returns zero for a zero base or a zero percent', () => {
      expect(percentOfPaise(0, 25)).toBe(0);
      expect(percentOfPaise(10000, 0)).toBe(0);
      expect(percentOfPaise(10000, dec('0'))).toBe(0);
    });

    it('allows a negative percent — a channel modifier of -10 is a 10% discount', () => {
      expect(percentOfPaise(10000, -10)).toBe(-1000);
      expect(percentOfPaise(1, -50)).toBe(-1); // -0.5 -> -1, away from zero
    });

    it('rejects a negative base — an amount to take a percentage of is never negative', () => {
      expect(() => percentOfPaise(-10000, 10)).toThrow(RangeError);
      expect(() => percentOfPaise(-1, 10)).toThrow(/must not be negative/);
    });

    it('rejects a fractional base and a non-finite percent', () => {
      expect(() => percentOfPaise(100.5, 10)).toThrow(/safe integer/);
      expect(() => percentOfPaise(10000, NaN)).toThrow(TypeError);
      expect(() => percentOfPaise(10000, Infinity)).toThrow(/finite/);
    });
  });

  // ── sumPaise / clampPaise ─────────────────────────────────────────────────

  describe('sumPaise and clampPaise', () => {
    it('sumPaise and clampPaise are total', () => {
      expect(sumPaise([100, 250, 3])).toBe(353);
      expect(sumPaise([])).toBe(0);
      expect(clampPaise(-5, 0, 100)).toBe(0);
      expect(clampPaise(500, 0, 100)).toBe(100);
    });

    it('sumPaise is order-independent and carries negative entries', () => {
      expect(sumPaise([100, 250, 3])).toBe(sumPaise([3, 250, 100]));
      expect(sumPaise([-100, 250])).toBe(150);
      expect(sumPaise([-100, -250])).toBe(-350);
      expect(sumPaise([0])).toBe(0);
    });

    it('sumPaise rejects a fractional element and an unsafe total', () => {
      expect(() => sumPaise([100, 1.5])).toThrow(/values\[1\]/);
      expect(() => sumPaise([Number.NaN])).toThrow(/safe integer/);
      expect(() => sumPaise([Number.MAX_SAFE_INTEGER, 1])).toThrow(
        /sum of values/,
      );
    });

    it('clampPaise returns the value untouched when it is already inside the range', () => {
      expect(clampPaise(50, 0, 100)).toBe(50);
      expect(clampPaise(0, 0, 100)).toBe(0);
      expect(clampPaise(100, 0, 100)).toBe(100);
      expect(clampPaise(-5, -100, 100)).toBe(-5);
      expect(clampPaise(7, 0, 0)).toBe(0);
    });

    it('clampPaise rejects an inverted range and a fractional bound', () => {
      expect(() => clampPaise(50, 100, 0)).toThrow(RangeError);
      expect(() => clampPaise(50, 100, 0)).toThrow(/must not exceed max/);
      expect(() => clampPaise(50.5, 0, 100)).toThrow(/safe integer/);
      expect(() => clampPaise(50, 0.5, 100)).toThrow(/safe integer/);
      expect(() => clampPaise(50, 0, 100.5)).toThrow(/safe integer/);
    });
  });

  // ── the composed order total ──────────────────────────────────────────────

  describe('the SPEC §3.3 order total', () => {
    // Two lines, both tax-inclusive:
    //   A ₹250.00 × 2 @ 5%   B ₹99.50 × 3 @ 12%
    const lineA = toPaise('250.00') * 2;
    const lineB = toPaise('99.50') * 3;

    it('sums gross line totals into a tax-inclusive subtotal', () => {
      expect(lineA).toBe(50000);
      expect(lineB).toBe(29850);
      expect(sumPaise([lineA, lineB])).toBe(79850);
    });

    it('carries tax_amount as a carve-out contained in the subtotal, never added to it', () => {
      const subtotal = sumPaise([lineA, lineB]);
      const taxAmount = sumPaise([
        inclusiveTaxPaise(lineA, 5),
        inclusiveTaxPaise(lineB, 12),
      ]);
      expect(taxAmount).toBe(2381 + 3198);
      expect(taxAmount).toBeLessThan(subtotal);

      const discount = percentOfPaise(subtotal, 10); // a 10% coupon
      const shipping = toPaise('49.00');
      const total = subtotal - discount + shipping;

      expect(discount).toBe(7985);
      expect(total).toBe(76765);
      expect(toDecimal(total).toFixed(2)).toBe('767.65');
      // The load-bearing assertion: adding the carved tax would over-charge.
      expect(total).not.toBe(subtotal - discount + shipping + taxAmount);
    });

    it('caps a loyalty redemption the way the checkout path does', () => {
      const subtotal = sumPaise([lineA, lineB]);
      const valuePerPoint = toPaise('0.25'); // settings loyalty.redeem_value_per_point
      const cap = percentOfPaise(subtotal, 20); // settings loyalty.max_redeem_percent
      expect(valuePerPoint).toBe(25);
      expect(cap).toBe(15970);
      expect(clampPaise(300 * valuePerPoint, 0, Math.min(cap, subtotal))).toBe(
        7500,
      );
      expect(clampPaise(900 * valuePerPoint, 0, Math.min(cap, subtotal))).toBe(
        15970,
      );
    });
  });
});
