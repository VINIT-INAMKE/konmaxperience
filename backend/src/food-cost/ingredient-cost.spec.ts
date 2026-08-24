import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrisma } from '../test-utils/mock-providers';
import { clearConversionCache } from '../common/utils/unit-conversion';
import { valueQuantity, type IngredientPriceCache } from './ingredient-cost';

/**
 * `unitConversion` is not in `PRISMA_MODELS`, so it arrives through
 * `mockPrisma`'s `overrides` parameter rather than by editing the shared
 * factory (Task 3's precedent).
 */
const makePrisma = (
  conversions: { from_unit: string; to_unit: string; factor: number }[] = [],
) =>
  mockPrisma({
    unitConversion: { findMany: jest.fn().mockResolvedValue(conversions) },
  });

const KG = { id: 'ing-1', base_unit: 'kg' };

describe('valueQuantity — the one place an ingredient gets a price (P6 decision 18)', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let cache: IngredientPriceCache;

  beforeEach(() => {
    // `unit-conversion.ts` memoises the conversion table at module scope with a
    // 5-minute TTL; a stale cache would leak between cases in this file.
    clearConversionCache();
    prisma = makePrisma();
    cache = new Map();
  });

  const value = (ingredient: { id: string; base_unit: string }, qty: number) =>
    valueQuantity(prisma as unknown as PrismaService, ingredient, qty, cache);

  it('values 2 kg of an ingredient priced ₹100/kg at ₹200, in integer paise', async () => {
    prisma.vendorPrice.findFirst.mockResolvedValue({
      price: new Prisma.Decimal('100.00'),
      unit: 'kg',
    });

    await expect(value(KG, 2)).resolves.toEqual({
      cost: 20_000,
      unpriced: false,
    });
  });

  it('converts the quantity into the vendor unit before multiplying', async () => {
    // Priced per gram; the movement is in kilograms.
    prisma = makePrisma([{ from_unit: 'kg', to_unit: 'g', factor: 1000 }]);
    prisma.vendorPrice.findFirst.mockResolvedValue({
      price: new Prisma.Decimal('0.10'),
      unit: 'g',
    });

    // 2 kg -> 2000 g x ₹0.10 = ₹200.
    await expect(value(KG, 2)).resolves.toEqual({
      cost: 20_000,
      unpriced: false,
    });
  });

  it('reports unpriced (not a silent zero) when the ingredient has no VendorPrice', async () => {
    prisma.vendorPrice.findFirst.mockResolvedValue(null);

    await expect(value(KG, 5)).resolves.toEqual({ cost: 0, unpriced: true });
  });

  it('reports unpriced when no conversion path reaches the price unit', async () => {
    // Base unit is litres, the vendor quotes kilograms, and no row bridges them.
    prisma.vendorPrice.findFirst.mockResolvedValue({
      price: new Prisma.Decimal('100.00'),
      unit: 'kg',
    });

    await expect(
      value({ id: 'ing-2', base_unit: 'litre' }, 3),
    ).resolves.toEqual({ cost: 0, unpriced: true });
  });

  it('reads the latest price by effective_date, per ingredient', async () => {
    prisma.vendorPrice.findFirst.mockResolvedValue({
      price: new Prisma.Decimal('100.00'),
      unit: 'kg',
    });

    await value(KG, 1);

    expect(prisma.vendorPrice.findFirst).toHaveBeenCalledWith({
      where: { ingredient_id: 'ing-1' },
      orderBy: { effective_date: 'desc' },
      select: { price: true, unit: true },
    });
  });

  it('queries once per ingredient however many times it is valued', async () => {
    prisma.vendorPrice.findFirst.mockResolvedValue({
      price: new Prisma.Decimal('100.00'),
      unit: 'kg',
    });

    await value(KG, 1);
    await value(KG, 2);
    await value(KG, 3);

    expect(prisma.vendorPrice.findFirst).toHaveBeenCalledTimes(1);
  });

  it('caches the negative answer too — an unpriced ingredient is not re-queried', async () => {
    prisma.vendorPrice.findFirst.mockResolvedValue(null);

    await value(KG, 1);
    await value(KG, 2);

    expect(prisma.vendorPrice.findFirst).toHaveBeenCalledTimes(1);
  });

  it('rounds a fractional paise result half-up rather than truncating', async () => {
    prisma.vendorPrice.findFirst.mockResolvedValue({
      price: new Prisma.Decimal('0.13'),
      unit: 'kg',
    });

    // 13 paise x 2.5 = 32.5 paise -> 33.
    await expect(value(KG, 2.5)).resolves.toEqual({
      cost: 33,
      unpriced: false,
    });
  });

  it('values a zero-quantity movement at zero without calling it unpriced', async () => {
    prisma.vendorPrice.findFirst.mockResolvedValue({
      price: new Prisma.Decimal('100.00'),
      unit: 'kg',
    });

    await expect(value(KG, 0)).resolves.toEqual({ cost: 0, unpriced: false });
  });
});
