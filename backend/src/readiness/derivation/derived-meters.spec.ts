import { READINESS_METERS } from '../../../prisma/seed-data/reference';
import {
  clamp,
  DERIVED_FORMULAS,
  HYBRID_PARTNER_CODES,
  procurement,
  quality,
  round2,
  sales,
  standardization,
} from './derived-meters';
import type {
  ProcurementInput,
  QualityInput,
  SalesInput,
  StandardizationInput,
} from './derivation.types';

/** The seeded knobs from `SETTING_DEFAULTS.readiness`, so the cases read like production. */
const SALES_CFG = {
  points_per_channel: 25,
  volume_threshold: 10,
  volume_bonus: 10,
};
const WASTE_MULTIPLIER = 5;

const product = (
  recipe_status: string | null,
  computed_cost: number | null,
): StandardizationInput['products'][number] => ({
  recipe_status,
  computed_cost,
});

const ingredient = (
  id: string,
  has_active_vendor_price: boolean,
  stock_on_hand: number,
  min_stock_level: number,
): ProcurementInput['ingredients'][number] => ({
  ingredient_id: id,
  has_active_vendor_price,
  stock_on_hand,
  min_stock_level,
});

const salesInput = (
  channels_with_orders: number,
  completed_orders: number,
): SalesInput => ({
  channels_with_orders,
  completed_orders,
  ...SALES_CFG,
});

const qualityInput = (
  waste_cost: number,
  cogs: number,
  average_rating: number | null,
): QualityInput => ({
  waste_cost,
  cogs,
  average_rating,
  waste_multiplier: WASTE_MULTIPLIER,
});

describe('clamp', () => {
  it('returns the floor for NaN — a formula that divided by nothing must not publish garbage', () => {
    expect(clamp(NaN)).toBe(0);
  });

  it('clamps below the floor', () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(-0.0001)).toBe(0);
  });

  it('clamps above the ceiling', () => {
    expect(clamp(140)).toBe(100);
    expect(clamp(100.0001)).toBe(100);
  });

  it('passes the boundaries through untouched', () => {
    expect(clamp(0)).toBe(0);
    expect(clamp(100)).toBe(100);
    expect(clamp(50.5)).toBe(50.5);
  });

  it('clamps the infinities to the range, not to the floor', () => {
    expect(clamp(Infinity)).toBe(100);
    expect(clamp(-Infinity)).toBe(0);
  });

  it('honours explicit bounds', () => {
    expect(clamp(5, 10, 20)).toBe(10);
    expect(clamp(25, 10, 20)).toBe(20);
    expect(clamp(15, 10, 20)).toBe(15);
    expect(clamp(NaN, 10, 20)).toBe(10);
  });
});

describe('round2', () => {
  it('rounds to two decimals — ReadinessSnapshot.value is Decimal(6,2)', () => {
    expect(round2(66.6666666)).toBe(66.67);
    expect(round2(33.3333333)).toBe(33.33);
    expect(round2(66.664)).toBe(66.66);
  });

  it('leaves whole numbers alone', () => {
    expect(round2(0)).toBe(0);
    expect(round2(100)).toBe(100);
  });
});

describe('standardization', () => {
  it('scores an empty catalog 0 — nothing is standardised when nothing is sellable', () => {
    expect(standardization({ products: [] })).toEqual({
      value: 0,
      sample_size: 0,
      detail: { total: 0, standardised: 0 },
    });
  });

  it('scores 3 of 4 approved-with-cost products at 75', () => {
    expect(
      standardization({
        products: [
          product('approved', 120),
          product('approved', 80.5),
          product('approved', 45),
          product('draft', 200),
        ],
      }),
    ).toEqual({
      value: 75,
      sample_size: 4,
      detail: { total: 4, standardised: 3 },
    });
  });

  it('does not count an approved recipe whose computed_cost is 0', () => {
    const result = standardization({
      products: [product('approved', 0), product('approved', 10)],
    });
    expect(result.value).toBe(50);
    expect(result.detail).toEqual({ total: 2, standardised: 1 });
  });

  it('does not count an approved recipe whose computed_cost is null', () => {
    const result = standardization({
      products: [product('approved', null), product('approved', 10)],
    });
    expect(result.value).toBe(50);
    expect(result.detail).toEqual({ total: 2, standardised: 1 });
  });

  it('does not count a costed recipe that is not approved', () => {
    const result = standardization({
      products: [
        product('draft', 10),
        product('pending', 10),
        product(null, 10),
      ],
    });
    expect(result).toEqual({
      value: 0,
      sample_size: 3,
      detail: { total: 3, standardised: 0 },
    });
  });

  it('does not count a negative computed_cost', () => {
    const result = standardization({ products: [product('approved', -5)] });
    expect(result.value).toBe(0);
  });

  it('scores a fully standardised catalog 100', () => {
    const result = standardization({
      products: [
        product('approved', 1),
        product('approved', 2),
        product('approved', 3),
      ],
    });
    expect(result).toEqual({
      value: 100,
      sample_size: 3,
      detail: { total: 3, standardised: 3 },
    });
  });

  it('rounds a repeating ratio to two decimals', () => {
    const result = standardization({
      products: [
        product('approved', 1),
        product('draft', 1),
        product('draft', 1),
      ],
    });
    expect(result.value).toBe(33.33);
  });

  it('is deterministic and does not mutate its input', () => {
    const input: StandardizationInput = {
      products: [product('approved', 10), product('draft', 10)],
    };
    const snapshot = JSON.parse(JSON.stringify(input)) as StandardizationInput;
    expect(standardization(input)).toEqual(standardization(input));
    expect(input).toEqual(snapshot);
  });
});

describe('procurement', () => {
  it('scores an empty BOM 0', () => {
    expect(procurement({ ingredients: [] })).toEqual({
      value: 0,
      sample_size: 0,
      detail: { total: 0, covered: 0 },
    });
  });

  it('scores 2 of 5 fully covered ingredients at 40', () => {
    expect(
      procurement({
        ingredients: [
          ingredient('a', true, 10, 5),
          ingredient('b', true, 10, 5),
          ingredient('c', false, 10, 5),
          ingredient('d', true, 1, 5),
          ingredient('e', false, 0, 5),
        ],
      }),
    ).toEqual({ value: 40, sample_size: 5, detail: { total: 5, covered: 2 } });
  });

  it('counts stock exactly equal to min_stock_level as covered', () => {
    const result = procurement({ ingredients: [ingredient('a', true, 5, 5)] });
    expect(result).toEqual({
      value: 100,
      sample_size: 1,
      detail: { total: 1, covered: 1 },
    });
  });

  it('does not count stock one unit below min_stock_level', () => {
    const result = procurement({
      ingredients: [ingredient('a', true, 4.99, 5)],
    });
    expect(result.value).toBe(0);
  });

  it('does not count an unpriced ingredient however much stock it has', () => {
    const result = procurement({
      ingredients: [ingredient('a', false, 10_000, 5)],
    });
    expect(result).toEqual({
      value: 0,
      sample_size: 1,
      detail: { total: 1, covered: 0 },
    });
  });

  it('counts a priced ingredient with a zero minimum and zero stock', () => {
    expect(
      procurement({ ingredients: [ingredient('a', true, 0, 0)] }).value,
    ).toBe(100);
  });

  it('rounds a repeating ratio to two decimals', () => {
    const result = procurement({
      ingredients: [
        ingredient('a', true, 5, 5),
        ingredient('b', false, 5, 5),
        ingredient('c', false, 5, 5),
      ],
    });
    expect(result.value).toBe(33.33);
  });

  it('is deterministic and does not mutate its input', () => {
    const input: ProcurementInput = {
      ingredients: [ingredient('a', true, 5, 5), ingredient('b', false, 1, 5)],
    };
    const snapshot = JSON.parse(JSON.stringify(input)) as ProcurementInput;
    expect(procurement(input)).toEqual(procurement(input));
    expect(input).toEqual(snapshot);
  });
});

describe('sales', () => {
  it('scores a silent week 0', () => {
    expect(sales(salesInput(0, 0))).toEqual({
      value: 0,
      sample_size: 0,
      detail: { channels: 0, base: 0, bonus: 0 },
    });
  });

  it('scores 2 channels below the volume threshold at 50', () => {
    expect(sales(salesInput(2, 4))).toEqual({
      value: 50,
      sample_size: 4,
      detail: { channels: 2, base: 50, bonus: 0 },
    });
  });

  it('adds the volume bonus above the threshold', () => {
    expect(sales(salesInput(2, 12))).toEqual({
      value: 60,
      sample_size: 12,
      detail: { channels: 2, base: 50, bonus: 10 },
    });
  });

  it('awards the bonus at exactly the threshold', () => {
    expect(sales(salesInput(1, 10))).toEqual({
      value: 35,
      sample_size: 10,
      detail: { channels: 1, base: 25, bonus: 10 },
    });
  });

  it('withholds the bonus one order below the threshold', () => {
    expect(sales(salesInput(1, 9)).value).toBe(25);
  });

  it('clamps four channels plus the bonus to 100, not 110', () => {
    expect(sales(salesInput(4, 40))).toEqual({
      value: 100,
      sample_size: 40,
      detail: { channels: 4, base: 100, bonus: 10 },
    });
  });

  it('clamps a fifth channel to 100', () => {
    expect(sales(salesInput(5, 0)).value).toBe(100);
  });

  it('awards the bonus alone when orders concentrate in no counted channel', () => {
    expect(sales(salesInput(0, 50)).value).toBe(10);
  });

  it('honours a reconfigured points/threshold/bonus triple', () => {
    expect(
      sales({
        channels_with_orders: 3,
        completed_orders: 100,
        points_per_channel: 10,
        volume_threshold: 50,
        volume_bonus: 0,
      }),
    ).toEqual({
      value: 30,
      sample_size: 100,
      detail: { channels: 3, base: 30, bonus: 0 },
    });
  });

  it('is deterministic', () => {
    const input = salesInput(3, 11);
    expect(sales(input)).toEqual(sales(input));
  });
});

describe('quality', () => {
  it('scores a week with no COGS and no ratings 100 — there is nothing to have wasted', () => {
    expect(quality(qualityInput(0, 0, null))).toEqual({
      value: 100,
      sample_size: 0,
      detail: { waste_half: 100, rating_half: 100 },
    });
  });

  it('blends a 10% waste ratio with a 4-star average at 65', () => {
    expect(quality(qualityInput(100, 1000, 4))).toEqual({
      value: 65,
      sample_size: 1,
      detail: { waste_half: 50, rating_half: 80 },
    });
  });

  it('falls the rating half back to the waste half when nobody rated', () => {
    expect(quality(qualityInput(100, 1000, null))).toEqual({
      value: 50,
      sample_size: 1,
      detail: { waste_half: 50, rating_half: 50 },
    });
  });

  it('floors the waste half at 0 when the waste ratio blows past the clamp', () => {
    expect(quality(qualityInput(10_000, 1000, 5))).toEqual({
      value: 50,
      sample_size: 1,
      detail: { waste_half: 0, rating_half: 100 },
    });
  });

  it('scores a 5-star average as a perfect rating half', () => {
    expect(quality(qualityInput(0, 1000, 5)).detail.rating_half).toBe(100);
  });

  it('scores a 1-star average as a rating half of 20', () => {
    expect(quality(qualityInput(0, 1000, 1))).toEqual({
      value: 60,
      sample_size: 1,
      detail: { waste_half: 100, rating_half: 20 },
    });
  });

  it('scores a 0 average rating as a rating half of 0', () => {
    expect(quality(qualityInput(0, 1000, 0)).detail.rating_half).toBe(0);
  });

  it('scores a waste-free costed week with no ratings 100', () => {
    expect(quality(qualityInput(0, 1000, null)).value).toBe(100);
  });

  it('treats a non-positive COGS as no COGS and reports sample_size 0', () => {
    expect(quality(qualityInput(500, -1, null))).toEqual({
      value: 100,
      sample_size: 0,
      detail: { waste_half: 100, rating_half: 100 },
    });
  });

  it('rounds both halves and the blend to two decimals', () => {
    // 1 / 300 x 100 x 5 = 1.6666… waste %, so the waste half is 98.3333…
    expect(quality(qualityInput(1, 300, null))).toEqual({
      value: 98.33,
      sample_size: 1,
      detail: { waste_half: 98.33, rating_half: 98.33 },
    });
  });

  it('honours a reconfigured waste multiplier', () => {
    expect(
      quality({
        waste_cost: 100,
        cogs: 1000,
        average_rating: null,
        waste_multiplier: 1,
      }).detail.waste_half,
    ).toBe(90);
  });

  it('is deterministic and does not mutate its input', () => {
    const input = qualityInput(100, 1000, 4);
    const snapshot = { ...input };
    expect(quality(input)).toEqual(quality(input));
    expect(input).toEqual(snapshot);
  });
});

describe('every formula', () => {
  const cases: [string, () => number][] = [
    [
      'standardization',
      () => standardization({ products: [product('approved', 1)] }).value,
    ],
    [
      'procurement',
      () => procurement({ ingredients: [ingredient('a', true, 5, 5)] }).value,
    ],
    ['sales', () => sales(salesInput(9, 999)).value],
    ['quality', () => quality(qualityInput(1e9, 1, 5)).value],
  ];

  it.each(cases)('%s stays inside [0, 100]', (_name, run) => {
    const value = run();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  });

  it('scores every empty input 0 except quality, which has nothing to have wasted', () => {
    expect(standardization({ products: [] }).value).toBe(0);
    expect(procurement({ ingredients: [] }).value).toBe(0);
    expect(sales(salesInput(0, 0)).value).toBe(0);
    expect(quality(qualityInput(0, 0, null)).value).toBe(100);
  });
});

describe('the formula registry', () => {
  it('maps every seeded derived meter formula_key to its meter code', () => {
    const seeded = READINESS_METERS.filter((m) => m.mode === 'derived');
    expect(seeded.length).toBe(Object.keys(DERIVED_FORMULAS).length);
    for (const meter of seeded) {
      expect(meter.formula_key).not.toBeNull();
      expect(
        DERIVED_FORMULAS[meter.formula_key as keyof typeof DERIVED_FORMULAS],
      ).toBe(meter.code);
    }
  });

  it('maps every seeded hybrid meter formula_key to a derived partner meter', () => {
    const seeded = READINESS_METERS.filter((m) => m.mode === 'hybrid');
    expect(seeded.length).toBe(Object.keys(HYBRID_PARTNER_CODES).length);
    const derivedCodes: string[] = Object.values(DERIVED_FORMULAS);
    for (const meter of seeded) {
      const partner =
        HYBRID_PARTNER_CODES[
          meter.formula_key as keyof typeof HYBRID_PARTNER_CODES
        ];
      expect(partner).toBeDefined();
      expect(derivedCodes).toContain(partner);
    }
  });

  it('leaves task_driven meters without a formula_key', () => {
    for (const meter of READINESS_METERS.filter(
      (m) => m.mode === 'task_driven',
    )) {
      expect(meter.formula_key).toBeNull();
    }
  });

  it('keeps the two registries disjoint — a key is derived or hybrid, never both', () => {
    const derivedKeys = Object.keys(DERIVED_FORMULAS);
    for (const key of Object.keys(HYBRID_PARTNER_CODES)) {
      expect(derivedKeys).not.toContain(key);
    }
  });
});
