import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { convertUnit } from '../common/utils/unit-conversion';
import { toPaise, type Paise } from '../common/money/money';

/**
 * The latest `VendorPrice` for one ingredient, already reduced to the money
 * domain: an integer number of paise **per one `unit`**.
 *
 * `null` is a cached *negative* answer — "this ingredient has no VendorPrice
 * row" — so a report over a thousand movements issues at most one query per
 * distinct ingredient whether or not that ingredient is priced.
 */
export type IngredientPrice = { pricePaise: Paise; unit: string };

/** Per-report memo of `ingredient_id -> latest price`. Build one, share it. */
export type IngredientPriceCache = Map<string, IngredientPrice | null>;

export interface IngredientValuation {
  /** Cost of `qty` of `ingredient`, in integer paise. */
  cost: Paise;
  /** True when no VendorPrice exists, or no conversion path to its unit. */
  unpriced: boolean;
}

/** The ingredient fields a valuation needs — nothing more, so specs stay small. */
export type ValuableIngredient = { id: string; base_unit: string };

/**
 * An ingredient's unit cost is the most recent `VendorPrice` — `Ingredient` has
 * no cost column. The price is quoted in the vendor's unit, so the quantity is
 * converted into that unit before multiplying (the pattern `WasteService`
 * established when it computes `cost_impact`).
 *
 * An unpriceable line returns `cost: 0` **and** `unpriced: true`. The caller
 * must surface the name; a silent zero turns a variance report into a lie
 * (P6 decision 18).
 *
 * Everything crossing the DB boundary is converted once, here: `VendorPrice.price`
 * is a `Decimal(12,2)` in rupees and becomes integer paise on the way in, so no
 * caller ever accumulates a float rupee value.
 */
export async function valueQuantity(
  prisma: PrismaService,
  ingredient: ValuableIngredient,
  qtyInBaseUnit: number,
  priceCache: IngredientPriceCache,
): Promise<IngredientValuation> {
  let price = priceCache.get(ingredient.id);
  if (price === undefined) {
    const row = await prisma.vendorPrice.findFirst({
      where: { ingredient_id: ingredient.id },
      orderBy: { effective_date: 'desc' },
      select: { price: true, unit: true },
    });
    price = row ? { pricePaise: toPaise(row.price), unit: row.unit } : null;
    priceCache.set(ingredient.id, price);
  }
  if (!price) return { cost: 0, unpriced: true };

  const converted = await convertUnit(
    qtyInBaseUnit,
    ingredient.base_unit,
    price.unit,
    prisma,
  );
  if (converted === null || !Number.isFinite(converted)) {
    return { cost: 0, unpriced: true };
  }

  // `converted` is a dimensionless quantity, so the product is still paise.
  // Rounded half-up through `Decimal` rather than by float multiplication: a
  // report sums thousands of these and IEEE drift is cumulative.
  const cost = new Prisma.Decimal(converted)
    .mul(price.pricePaise)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();

  // The integer-paise invariant is asserted rather than assumed: a corrupt
  // conversion factor must throw here, not silently poison a report total.
  if (!Number.isSafeInteger(cost)) {
    throw new TypeError(
      `Valuation of ingredient ${ingredient.id} produced ${String(cost)}, which is not a safe integer number of paise`,
    );
  }
  return { cost, unpriced: false };
}
