import {
  FulfilmentType,
  OrderChannel,
  Prisma,
  ProductStatus,
  ProductType,
  StockMode,
} from '@prisma/client';
import { mockPrisma } from '../test-utils/mock-providers';
import { inclusiveTaxPaise } from '../common/money/money';
import type { ProductAvailability } from '../catalog/catalog.service';
import {
  CartPricingService,
  groupLinesByFulfilment,
  type CartLineInput,
} from './cart-pricing.service';

// ---------------------------------------------------------------
// Fixtures — the exact `select` shape `CartPricingService.price` reads.
// ---------------------------------------------------------------

type VariantRow = {
  id: string;
  name: string;
  sku: string | null;
  price_delta: Prisma.Decimal;
  stock_on_hand: Prisma.Decimal;
  is_default: boolean;
  status: ProductStatus;
};

type ProductRow = {
  id: string;
  name: string;
  type: ProductType;
  fulfilment: FulfilmentType;
  stock_mode: StockMode;
  status: ProductStatus;
  base_price: Prisma.Decimal;
  tax_rate: Prisma.Decimal;
  weight_grams: number | null;
  hsn_code: string | null;
  event_id: string | null;
  variants: VariantRow[];
};

const AVAILABLE: ProductAvailability = {
  available: true,
  servings_remaining: 99,
  preparation_type: 'scratch',
};

function variant(over: Partial<VariantRow> = {}): VariantRow {
  return {
    id: 'v1',
    name: 'Large',
    sku: 'KX-THALI-L',
    price_delta: new Prisma.Decimal('50.00'),
    stock_on_hand: new Prisma.Decimal('0'),
    is_default: false,
    status: ProductStatus.active,
    ...over,
  };
}

/** A `prepared_food` / `local` product by default; every case overrides what it needs. */
function product(over: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'p1',
    name: 'Konma Signature Thali',
    type: ProductType.prepared_food,
    fulfilment: FulfilmentType.local,
    stock_mode: StockMode.derived_from_recipe,
    status: ProductStatus.active,
    base_price: new Prisma.Decimal('450.00'),
    tax_rate: new Prisma.Decimal('5.00'),
    weight_grams: null,
    hsn_code: null,
    event_id: null,
    variants: [],
    ...over,
  };
}

const PACKAGED = product({
  id: 'p2',
  name: 'Cold-Pressed Coconut Oil',
  type: ProductType.packaged,
  fulfilment: FulfilmentType.shipped,
  stock_mode: StockMode.tracked,
  base_price: new Prisma.Decimal('649.00'),
  tax_rate: new Prisma.Decimal('12.00'),
  weight_grams: 550,
  hsn_code: '15131100',
  variants: [
    variant({
      id: 'v2',
      name: '500 ml',
      sku: 'KX-OIL-500',
      price_delta: new Prisma.Decimal('0'),
      stock_on_hand: new Prisma.Decimal('10'),
      is_default: true,
    }),
  ],
});

const EXPERIENCE = product({
  id: 'p3',
  name: "Chef's Table Dinner",
  type: ProductType.experience,
  fulfilment: FulfilmentType.booking,
  stock_mode: StockMode.capacity,
  base_price: new Prisma.Decimal('2500.00'),
  tax_rate: new Prisma.Decimal('5.00'),
  event_id: 'e1',
});

function mockCatalog(
  batch: Record<string, ProductAvailability> = {},
  single: jest.Mock = jest.fn().mockResolvedValue(AVAILABLE),
) {
  return {
    getAllServingsAvailable: jest.fn().mockResolvedValue(batch),
    getServingsAvailable: single,
  };
}

function buildService(
  products: ProductRow[],
  opts: {
    modifier?: { modifier_type: string; modifier_value: Prisma.Decimal } | null;
    catalog?: ReturnType<typeof mockCatalog>;
  } = {},
) {
  const prisma = mockPrisma({
    product: { findMany: jest.fn().mockResolvedValue(products) },
    channelModifier: {
      findFirst: jest.fn().mockResolvedValue(opts.modifier ?? null),
    },
  });
  const catalog = opts.catalog ?? mockCatalog();
  const service = new CartPricingService(prisma as never, catalog as never);
  return { prisma, catalog, service };
}

function line(
  over: Partial<CartLineInput> & { productId: string },
): CartLineInput {
  return { quantity: 1, ...over };
}

describe('CartPricingService', () => {
  // -------------------------------------------------------------
  // 1-3: fulfilment derivation per product type (decision 6)
  // -------------------------------------------------------------

  it('prices a prepared_food line as base_price + variant delta and derives fulfilment = local', async () => {
    const thali = product({ variants: [variant()] });
    const { service } = buildService([thali]);

    const priced = await service.price(
      [line({ productId: 'p1', variantId: 'v1', quantity: 2 })],
      OrderChannel.delivery,
    );

    expect(priced.lines).toHaveLength(1);
    expect(priced.lines[0]).toMatchObject({
      product_id: 'p1',
      variant_id: 'v1',
      name: 'Konma Signature Thali — Large',
      sku: 'KX-THALI-L',
      type: ProductType.prepared_food,
      fulfilment: FulfilmentType.local,
      unit_price: 50000,
      gross: 100000,
      tax_rate: '5.00',
      available: true,
      unavailable_reason: null,
      event_id: null,
    });
    expect(priced.subtotal).toBe(100000);
    expect(priced.has_local).toBe(true);
    expect(priced.has_shipped).toBe(false);
    expect(priced.has_booking).toBe(false);
    expect(priced.shipped_weight_grams).toBe(0);
  });

  it('derives fulfilment = shipped for a packaged line and carries weight into shipped_weight_grams', async () => {
    const { service } = buildService([PACKAGED]);

    const priced = await service.price(
      [line({ productId: 'p2', quantity: 2 })],
      OrderChannel.delivery,
    );

    expect(priced.lines[0]).toMatchObject({
      product_id: 'p2',
      variant_id: 'v2',
      fulfilment: FulfilmentType.shipped,
      unit_price: 64900,
      gross: 129800,
      weight_grams: 550,
      hsn_code: '15131100',
    });
    expect(priced.has_shipped).toBe(true);
    expect(priced.has_local).toBe(false);
    expect(priced.shipped_weight_grams).toBe(1100);
  });

  it('derives fulfilment = booking for an experience line and carries its event_id', async () => {
    const catalog = mockCatalog(
      {},
      jest.fn().mockResolvedValue({
        available: true,
        servings_remaining: 8,
        preparation_type: 'capacity',
      }),
    );
    const { service } = buildService([EXPERIENCE], { catalog });

    const priced = await service.price(
      [line({ productId: 'p3', quantity: 2 })],
      OrderChannel.delivery,
    );

    // `getAllServingsAvailable` never covers capacity products, so the service
    // falls back to the single-product call rather than assuming "sellable".
    expect(catalog.getServingsAvailable).toHaveBeenCalledWith('p3');
    expect(priced.lines[0]).toMatchObject({
      product_id: 'p3',
      type: ProductType.experience,
      fulfilment: FulfilmentType.booking,
      event_id: 'e1',
      unit_price: 250000,
      gross: 500000,
    });
    expect(priced.has_booking).toBe(true);
  });

  // -------------------------------------------------------------
  // 4 + 7 + 12-13 + 16: availability and rejection
  // -------------------------------------------------------------

  it('rejects a tracked line whose stock is short and excludes it from every total', async () => {
    const apron = product({
      id: 'p4',
      name: 'Linen Apron',
      type: ProductType.merchandise,
      fulfilment: FulfilmentType.shipped,
      stock_mode: StockMode.tracked,
      base_price: new Prisma.Decimal('999.00'),
      weight_grams: 300,
      variants: [
        variant({
          id: 'v4',
          name: 'One size',
          sku: 'KX-APR-1',
          price_delta: new Prisma.Decimal('0'),
          stock_on_hand: new Prisma.Decimal('0'),
          is_default: true,
        }),
      ],
    });
    const { service } = buildService([product(), apron]);

    const priced = await service.price(
      [line({ productId: 'p1' }), line({ productId: 'p4', quantity: 2 })],
      OrderChannel.delivery,
    );

    expect(priced.lines).toHaveLength(1);
    expect(priced.rejected).toEqual([
      {
        product_id: 'p4',
        variant_id: 'v4',
        name: 'Linen Apron',
        reason: 'Only 0 left',
      },
    ]);
    expect(priced.subtotal).toBe(45000);
    expect(priced.has_shipped).toBe(false);
    expect(priced.shipped_weight_grams).toBe(0);
  });

  it('rejects an archived product as no longer available', async () => {
    const { service } = buildService([
      product({ status: ProductStatus.archived }),
    ]);

    const priced = await service.price(
      [line({ productId: 'p1', name: 'Konma Signature Thali' })],
      OrderChannel.delivery,
    );

    expect(priced.lines).toHaveLength(0);
    expect(priced.rejected[0].reason).toMatch(/no longer available/i);
    expect(priced.subtotal).toBe(0);
    expect(priced.tax_total).toBe(0);
    expect(priced.tax_breakup).toEqual([]);
  });

  it('rejects a product the catalog no longer holds at all', async () => {
    const { service } = buildService([]);

    const priced = await service.price(
      [line({ productId: 'ghost', name: 'Deleted dish' })],
      OrderChannel.delivery,
    );

    expect(priced.rejected).toEqual([
      {
        product_id: 'ghost',
        variant_id: null,
        name: 'Deleted dish',
        reason: 'No longer available',
      },
    ]);
  });

  it('rejects an explicitly chosen variant that is no longer active', async () => {
    const thali = product({
      variants: [variant({ status: ProductStatus.archived })],
    });
    const { service } = buildService([thali]);

    const priced = await service.price(
      [line({ productId: 'p1', variantId: 'v1' })],
      OrderChannel.delivery,
    );

    expect(priced.lines).toHaveLength(0);
    expect(priced.rejected[0]).toMatchObject({
      product_id: 'p1',
      variant_id: 'v1',
      reason: 'Selected option is no longer available',
    });
  });

  it('rejects a sold-out capacity line and reports the remainder when the event is short', async () => {
    const soldOut = mockCatalog(
      {},
      jest.fn().mockResolvedValue({
        available: false,
        servings_remaining: 0,
        preparation_type: 'capacity',
      }),
    );
    const short = mockCatalog(
      {},
      jest.fn().mockResolvedValue({
        available: true,
        servings_remaining: 1,
        preparation_type: 'capacity',
      }),
    );

    const soldOutResult = await buildService([EXPERIENCE], {
      catalog: soldOut,
    }).service.price([line({ productId: 'p3' })], OrderChannel.delivery);
    expect(soldOutResult.rejected[0].reason).toBe('Sold out');

    const shortResult = await buildService([EXPERIENCE], {
      catalog: short,
    }).service.price(
      [line({ productId: 'p3', quantity: 4 })],
      OrderChannel.delivery,
    );
    expect(shortResult.rejected[0].reason).toBe('Only 1 left');
  });

  it('fails closed when availability cannot be read', async () => {
    const catalog = mockCatalog(
      {},
      jest.fn().mockRejectedValue(new Error('row vanished')),
    );
    const { service } = buildService([EXPERIENCE], { catalog });

    const priced = await service.price(
      [line({ productId: 'p3' })],
      OrderChannel.delivery,
    );

    expect(priced.lines).toHaveLength(0);
    expect(priced.rejected[0].reason).toBe('Sold out');
  });

  it('prefers the batched availability pass over per-product calls for recipe-backed products', async () => {
    const catalog = mockCatalog({
      p1: {
        available: true,
        servings_remaining: 3,
        preparation_type: 'scratch',
      },
    });
    const { service } = buildService([product()], { catalog });

    const priced = await service.price(
      [line({ productId: 'p1', quantity: 3 })],
      OrderChannel.delivery,
    );

    expect(catalog.getAllServingsAvailable).toHaveBeenCalledTimes(1);
    expect(catalog.getServingsAvailable).not.toHaveBeenCalled();
    expect(priced.lines).toHaveLength(1);
  });

  it('rejects a non-positive or fractional quantity instead of poisoning the paise domain', async () => {
    const { service } = buildService([product()]);

    const priced = await service.price(
      [
        line({ productId: 'p1', quantity: 0 }),
        line({ productId: 'p1', quantity: 2.5 }),
      ],
      OrderChannel.delivery,
    );

    expect(priced.lines).toHaveLength(0);
    expect(priced.rejected.map((r) => r.reason)).toEqual([
      'Invalid quantity',
      'Invalid quantity',
    ]);
    expect(priced.subtotal).toBe(0);
  });

  // -------------------------------------------------------------
  // 5 + 10: channel modifiers
  // -------------------------------------------------------------

  it('spreads a percentage channel modifier per unit and includes it in gross', async () => {
    const { service } = buildService([product()], {
      modifier: {
        modifier_type: 'percentage',
        modifier_value: new Prisma.Decimal('10'),
      },
    });

    const priced = await service.price(
      [line({ productId: 'p1', quantity: 2 })],
      OrderChannel.delivery,
    );

    expect(priced.lines[0].unit_price).toBe(49500);
    expect(priced.lines[0].gross).toBe(99000);
    expect(priced.channel_modifier).toBe(9000);
    expect(priced.subtotal).toBe(99000);
  });

  it('applies a fixed channel modifier once per unit and never lets a line go negative', async () => {
    const positive = await buildService([product()], {
      modifier: {
        modifier_type: 'fixed',
        modifier_value: new Prisma.Decimal('20.00'),
      },
    }).service.price(
      [line({ productId: 'p1', quantity: 3 })],
      OrderChannel.takeaway,
    );
    expect(positive.lines[0].unit_price).toBe(47000);
    expect(positive.channel_modifier).toBe(6000);

    const clamped = await buildService([product()], {
      modifier: {
        modifier_type: 'fixed',
        modifier_value: new Prisma.Decimal('-500.00'),
      },
    }).service.price([line({ productId: 'p1' })], OrderChannel.takeaway);
    expect(clamped.lines[0].unit_price).toBe(0);
    expect(clamped.lines[0].gross).toBe(0);
    expect(clamped.lines[0].tax).toBe(0);
    expect(clamped.channel_modifier).toBe(-45000);
  });

  // -------------------------------------------------------------
  // 6: inclusive GST carve-out (decision 1)
  // -------------------------------------------------------------

  it('carves inclusive tax out of each line and groups tax_breakup by rate', async () => {
    const side = product({
      id: 'p5',
      name: 'Kokum Cooler',
      base_price: new Prisma.Decimal('100.00'),
      tax_rate: new Prisma.Decimal('5.00'),
    });
    const { service } = buildService([product(), PACKAGED, side]);

    const priced = await service.price(
      [
        line({ productId: 'p1', quantity: 2 }),
        line({ productId: 'p2' }),
        line({ productId: 'p5' }),
      ],
      OrderChannel.delivery,
    );

    const thaliTax = inclusiveTaxPaise(90000, '5.00');
    const oilTax = inclusiveTaxPaise(64900, '12.00');
    const sideTax = inclusiveTaxPaise(10000, '5.00');

    expect(priced.lines.map((l) => l.tax)).toEqual([thaliTax, oilTax, sideTax]);
    // Tax is contained in the gross, never added to it.
    expect(priced.subtotal).toBe(90000 + 64900 + 10000);
    expect(priced.tax_total).toBe(thaliTax + oilTax + sideTax);
    expect(priced.tax_breakup).toEqual([
      {
        rate: '5.00',
        taxable: 90000 - thaliTax + (10000 - sideTax),
        tax: thaliTax + sideTax,
      },
      { rate: '12.00', taxable: 64900 - oilTax, tax: oilTax },
    ]);
    for (const bucket of priced.tax_breakup) {
      expect(Number.isSafeInteger(bucket.tax)).toBe(true);
      expect(Number.isSafeInteger(bucket.taxable)).toBe(true);
    }
  });

  it('carves nothing from a zero-rated line', async () => {
    const { service } = buildService([
      product({ tax_rate: new Prisma.Decimal('0') }),
    ]);

    const priced = await service.price(
      [line({ productId: 'p1' })],
      OrderChannel.delivery,
    );

    expect(priced.lines[0].tax_rate).toBe('0.00');
    expect(priced.lines[0].tax).toBe(0);
    expect(priced.tax_total).toBe(0);
    expect(priced.tax_breakup).toEqual([
      { rate: '0.00', taxable: 45000, tax: 0 },
    ]);
  });

  // -------------------------------------------------------------
  // 8: mixed carts
  // -------------------------------------------------------------

  it('flags all three fulfilment types on a mixed cart and splits them into groups', async () => {
    const catalog = mockCatalog({
      p1: AVAILABLE,
    });
    const { service } = buildService([product(), PACKAGED, EXPERIENCE], {
      catalog,
    });

    const priced = await service.price(
      [
        line({ productId: 'p1', quantity: 2 }),
        line({ productId: 'p2' }),
        line({ productId: 'p3', quantity: 2 }),
      ],
      OrderChannel.delivery,
    );

    expect(priced.has_local).toBe(true);
    expect(priced.has_shipped).toBe(true);
    expect(priced.has_booking).toBe(true);
    expect(priced.shipped_weight_grams).toBe(550);
    expect(priced.subtotal).toBe(90000 + 64900 + 500000);

    const groups = groupLinesByFulfilment(priced.lines);
    expect(groups.local.map((l) => l.product_id)).toEqual(['p1']);
    expect(groups.shipped.map((l) => l.product_id)).toEqual(['p2']);
    expect(groups.booking.map((l) => l.product_id)).toEqual(['p3']);
  });

  // -------------------------------------------------------------
  // 9: the server price always wins
  // -------------------------------------------------------------

  it('ignores client-sent prices and re-prices from the database', async () => {
    const { service } = buildService([product()]);

    const priced = await service.price(
      [
        {
          productId: 'p1',
          variantId: null,
          quantity: 2,
          unitPrice: 1 /* lie */,
          name: 'x',
          imageUrl: null,
        },
      ],
      OrderChannel.delivery,
    );

    expect(priced.lines[0].unit_price).toBe(45000);
    expect(priced.lines[0].name).toBe('Konma Signature Thali');
    expect(priced.subtotal).toBe(90000);
    expect(priced.lines[0].tax).toBe(inclusiveTaxPaise(90000, 5));
  });

  // -------------------------------------------------------------
  // Variant selection and the empty cart
  // -------------------------------------------------------------

  it('prices against the default variant when the client picked none', async () => {
    const thali = product({
      variants: [
        variant({
          id: 'vA',
          name: 'Regular',
          sku: 'KX-THALI-R',
          price_delta: new Prisma.Decimal('0'),
        }),
        variant({
          id: 'vB',
          name: 'Feast',
          sku: 'KX-THALI-F',
          price_delta: new Prisma.Decimal('120.00'),
          is_default: true,
        }),
      ],
    });
    const { service } = buildService([thali]);

    const priced = await service.price(
      [line({ productId: 'p1' })],
      OrderChannel.delivery,
    );

    expect(priced.lines[0].variant_id).toBe('vB');
    expect(priced.lines[0].unit_price).toBe(57000);
  });

  it('returns an empty priced cart without querying the catalog', async () => {
    const { service, prisma, catalog } = buildService([]);

    const priced = await service.price([], OrderChannel.takeaway);

    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(catalog.getAllServingsAvailable).not.toHaveBeenCalled();
    expect(priced).toEqual({
      lines: [],
      subtotal: 0,
      tax_total: 0,
      tax_breakup: [],
      channel: OrderChannel.takeaway,
      channel_modifier: 0,
      has_local: false,
      has_shipped: false,
      has_booking: false,
      shipped_weight_grams: 0,
      rejected: [],
    });
  });
});
