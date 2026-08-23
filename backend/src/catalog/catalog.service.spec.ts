import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { CatalogCacheService } from './catalog-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  mockEventEmitter,
  provideEventEmitter,
} from '../test-utils/mock-providers';
import { DomainEvent } from '../common/events/domain-events';

const emitter = mockEventEmitter();

/**
 * A pass-through cache: every `wrap` is a miss, so these suites keep asserting
 * on the real Prisma calls. `CatalogCacheService` has its own suite.
 */
const cache = {
  wrap: jest.fn(<T>(_key: string, compute: () => Promise<T>) => compute()),
  invalidate: jest.fn().mockResolvedValue(undefined),
};

const provideCatalogCache = () => ({
  provide: CatalogCacheService,
  useValue: cache,
});

jest.mock('../common/utils/unit-conversion', () => ({
  convertUnit: jest.fn((qty: number, from: string, to: string) => {
    if (from === to) return Promise.resolve(qty);
    if (from === 'kg' && to === 'g') return Promise.resolve(qty * 1000);
    return Promise.resolve(null);
  }),
}));

const dec = (n: number) => ({ valueOf: () => n, toNumber: () => n });

const assembleProduct = (lineUnit: string) => ({
  id: 'p-1',
  status: 'active',
  type: 'prepared_food',
  stock_mode: 'derived_from_recipe',
  recipe: {
    id: 'r-assemble',
    preparation_type: 'assemble',
    RecipeLines: [
      {
        input_type: 'ingredient',
        quantity: dec(0.5),
        unit: lineUnit,
        ingredient_id: 'ing-1',
        ingredient: { id: 'ing-1', base_unit: 'g' },
        source_recipe_id: null,
        source_recipe: null,
      },
      {
        input_type: 'recipe',
        quantity: dec(2),
        unit: 'portion',
        ingredient_id: null,
        ingredient: null,
        source_recipe_id: 'sr-1',
        source_recipe: { id: 'sr-1', yield_unit: 'portion' },
      },
    ],
  },
});

describe('CatalogService.computeServings (assemble)', () => {
  let service: CatalogService;
  const prisma = {
    product: { findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    ingredientStock: { findMany: jest.fn() },
    prepBatch: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        provideCatalogCache(),
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(CatalogService);
    jest.clearAllMocks();
    prisma.ingredientStock.findMany.mockResolvedValue([
      { ingredient_id: 'ing-1', current_quantity: dec(2000) },
    ]);
    prisma.prepBatch.findMany.mockResolvedValue([
      { recipe_id: 'sr-1', quantity_remaining: dec(10) },
    ]);
  });

  it('converts line units to the stock base unit (0.5 kg per serving, 2000 g in stock -> 4)', async () => {
    prisma.product.findMany.mockResolvedValue([assembleProduct('kg')]);

    const result = await service.getAllServingsAvailable();

    expect(result['p-1']).toEqual({
      available: true,
      servings_remaining: 4,
      preparation_type: 'assemble',
    });
  });

  it('is unavailable when a line has no unit conversion', async () => {
    prisma.product.findMany.mockResolvedValue([assembleProduct('lb')]);

    const result = await service.getAllServingsAvailable();

    expect(result['p-1']).toEqual({
      available: false,
      servings_remaining: 0,
      preparation_type: 'assemble',
    });
  });

  it('single-product path queries stock and batches instead of returning 0', async () => {
    prisma.product.findUniqueOrThrow.mockResolvedValue(assembleProduct('kg'));

    const result = await service.getServingsAvailable('p-1');

    expect(result.servings_remaining).toBe(4);
    expect(prisma.ingredientStock.findMany).toHaveBeenCalledWith({
      where: { ingredient_id: 'ing-1' },
    });
  });

  it('a draft product is never available', async () => {
    prisma.product.findUniqueOrThrow.mockResolvedValue({
      ...assembleProduct('kg'),
      status: 'draft',
    });

    await expect(service.getServingsAvailable('p-1')).resolves.toEqual({
      available: false,
      servings_remaining: 0,
      preparation_type: 'assemble',
    });
  });

  it('the batch endpoint only asks for active recipe-backed products', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.getAllServingsAvailable();

    const args = prisma.product.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      status: 'active',
      type: { in: ['prepared_food', 'packaged'] },
    });
  });

  it('tracked merchandise is available from variant stock, not a recipe', async () => {
    prisma.product.findUniqueOrThrow.mockResolvedValue({
      status: 'active',
      stock_mode: 'tracked',
      type: 'merchandise',
      variants: [{ stock_on_hand: dec(4) }, { stock_on_hand: dec(2) }],
      recipe: null,
    });

    await expect(service.getServingsAvailable('p-1')).resolves.toMatchObject({
      available: true,
      servings_remaining: 6,
    });
  });

  it('an experience is available from event capacity minus confirmed guests', async () => {
    prisma.product.findUniqueOrThrow.mockResolvedValue({
      status: 'active',
      stock_mode: 'capacity',
      type: 'experience',
      recipe: null,
      event: { capacity: 10, bookings: [{ guests: 4 }, { guests: 2 }] },
    });

    await expect(service.getServingsAvailable('p-2')).resolves.toMatchObject({
      available: true,
      servings_remaining: 4,
    });
  });

  it('a sold-out experience is unavailable', async () => {
    prisma.product.findUniqueOrThrow.mockResolvedValue({
      status: 'active',
      stock_mode: 'capacity',
      type: 'experience',
      recipe: null,
      event: { capacity: 6, bookings: [{ guests: 6 }] },
    });

    await expect(service.getServingsAvailable('p-2')).resolves.toMatchObject({
      available: false,
      servings_remaining: 0,
    });
  });
});

describe('CatalogService product queries', () => {
  let service: CatalogService;
  let prisma: { product: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { product: { findMany: jest.fn().mockResolvedValue([]) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        provideCatalogCache(),
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(CatalogService);
  });

  it('findProductsPublic selects only id and preparation_type from the recipe', async () => {
    await service.findProductsPublic('cat-1', 'brand-1');
    const args = prisma.product.findMany.mock.calls[0][0];
    expect(args.include.recipe.select).toEqual({
      id: true,
      preparation_type: true,
    });
    expect(args.where).toEqual({
      category_id: 'cat-1',
      brand_id: 'brand-1',
      status: 'active',
    });
  });

  it('findProductsPublic never leaks cost, yield, margin or BOM fields', async () => {
    await service.findProductsPublic(undefined, 'brand-1');
    const args = prisma.product.findMany.mock.calls[0][0];
    expect(JSON.stringify(args)).not.toMatch(
      /computed_cost|yield_qty|RecipeLines|stock_on_hand|low_stock_threshold/,
    );
  });

  it('findProductsStaff keeps cost fields for ops screens and hides archived', async () => {
    await service.findProductsStaff(undefined, 'brand-1');
    const args = prisma.product.findMany.mock.calls[0][0];
    expect(args.include.recipe.select).toMatchObject({
      computed_cost: true,
      yield_qty: true,
    });
    expect(args.where).toEqual({
      brand_id: 'brand-1',
      status: { not: 'archived' },
    });
  });

  it('filters by product type when one is given', async () => {
    await service.findProductsStaff(
      undefined,
      undefined,
      'merchandise' as never,
    );
    const args = prisma.product.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ type: 'merchandise' });
  });
});

describe('CatalogService write guards', () => {
  let service: CatalogService;
  const prisma = {
    product: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    recipe: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        provideCatalogCache(),
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(CatalogService);
    jest.clearAllMocks();
  });

  it('rejects a prepared_food product whose recipe is not approved', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'r-1', status: 'draft' });

    await expect(
      service.createProduct(
        { type: 'prepared_food', recipe_id: 'r-1' } as never,
        'u-1',
      ),
    ).rejects.toThrow(/Only approved recipes/);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects a packaged product with no recipe at all', async () => {
    await expect(
      service.createProduct({ type: 'packaged' } as never, 'u-1'),
    ).rejects.toThrow(/must reference a recipe/);
  });

  it('lets merchandise through without a recipe and stamps the author', async () => {
    prisma.product.create.mockResolvedValue({ id: 'p-9' });

    await service.createProduct(
      { type: 'merchandise', name: 'Tote' } as never,
      'u-1',
    );

    expect(prisma.product.create.mock.calls[0][0].data).toMatchObject({
      type: 'merchandise',
      created_by: 'u-1',
      updated_by: 'u-1',
    });
  });

  it('a status-only patch does not re-validate the recipe', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p-1',
      type: 'prepared_food',
      recipe_id: 'r-1',
    });
    prisma.product.update.mockResolvedValue({ id: 'p-1' });

    await service.updateProduct('p-1', { status: 'active' } as never, 'u-1');

    expect(prisma.recipe.findUnique).not.toHaveBeenCalled();
    expect(prisma.product.update.mock.calls[0][0].data).toMatchObject({
      status: 'active',
      updated_by: 'u-1',
    });
  });
});

// -----------------------------------------------------------------
// setStatus — product.published domain event (SPEC §4.1)
// -----------------------------------------------------------------
describe('CatalogService.setStatus — product.published', () => {
  let service: CatalogService;
  const prisma = {
    product: { update: jest.fn(), findUnique: jest.fn() },
  };
  const published = {
    id: 'p-1',
    node_id: 'node-1',
    name: 'Masala Chai',
    slug: 'masala-chai',
    type: 'prepared_food',
    status: 'active',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        provideCatalogCache(),
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(CatalogService);
    jest.clearAllMocks();
    emitter.emit.mockReturnValue(true);
  });

  it('emits once, after the update resolves, on draft -> active', async () => {
    prisma.product.findUnique.mockResolvedValue({ status: 'draft' });
    let updateResolved = false;
    prisma.product.update.mockImplementation(async () => {
      updateResolved = true;
      return published;
    });
    emitter.emit.mockImplementation(() => {
      expect(updateResolved).toBe(true);
      return true;
    });

    await service.setStatus('p-1', 'active' as never, 'u-1');

    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith(
      DomainEvent.PRODUCT_PUBLISHED,
      expect.objectContaining({
        node_id: 'node-1',
        actor: { actor_type: 'user', actor_id: 'u-1' },
        occurred_at: expect.any(String),
        productId: 'p-1',
        name: 'Masala Chai',
        slug: 'masala-chai',
        type: 'prepared_food',
      }),
    );
  });

  it('does not re-emit when the product is already active', async () => {
    prisma.product.findUnique.mockResolvedValue({ status: 'active' });
    prisma.product.update.mockResolvedValue(published);

    await service.setStatus('p-1', 'active' as never, 'u-1');

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('does not emit when archiving', async () => {
    prisma.product.findUnique.mockResolvedValue({ status: 'active' });
    prisma.product.update.mockResolvedValue({
      ...published,
      status: 'archived',
    });

    await service.archiveProduct('p-1', 'u-1');

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('still resolves when the emitter throws', async () => {
    prisma.product.findUnique.mockResolvedValue({ status: 'draft' });
    prisma.product.update.mockResolvedValue(published);
    emitter.emit.mockImplementation(() => {
      throw new Error('listener exploded');
    });

    await expect(
      service.setStatus('p-1', 'active' as never, 'u-1'),
    ).resolves.toEqual(published);
  });
});

// -----------------------------------------------------------------
// Public list — cursor envelope + CAT-03 field absence
// -----------------------------------------------------------------
describe('CatalogService.findProductsPublic — cursor envelope', () => {
  let service: CatalogService;
  const prisma = { product: { findMany: jest.fn() } };
  const row = (id: string) => ({ id, name: `p-${id}` });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        provideCatalogCache(),
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(CatalogService);
    jest.clearAllMocks();
  });

  it('answers with { items, next_cursor }, not a bare array', async () => {
    prisma.product.findMany.mockResolvedValue([row('a'), row('b')]);

    await expect(service.findProductsPublic()).resolves.toEqual({
      items: [row('a'), row('b')],
      next_cursor: null,
    });
  });

  it('peeks one row past the page and hands back the LAST page row as the cursor', async () => {
    // take = 2, so a third row means "there is more".
    prisma.product.findMany.mockResolvedValue([row('a'), row('b'), row('c')]);

    const page = await service.findProductsPublic(
      undefined,
      undefined,
      undefined,
      undefined,
      2,
    );

    expect(prisma.product.findMany.mock.calls[0][0].take).toBe(3);
    expect(page.items).toEqual([row('a'), row('b')]);
    // 'c' was only the peek — returning it would make the next `skip: 1` eat it.
    expect(page.next_cursor).toBe('b');
  });

  it('turns a cursor into { cursor: { id }, skip: 1 } and orders by (name, id)', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findProductsPublic(undefined, undefined, undefined, 'b');

    const args = prisma.product.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: 'b' });
    expect(args.skip).toBe(1);
    expect(args.orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }]);
  });

  it('omits cursor/skip entirely on the first page', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findProductsPublic();

    const args = prisma.product.findMany.mock.calls[0][0];
    expect(args.cursor).toBeUndefined();
    expect(args.skip).toBeUndefined();
  });

  it('clamps limit to 200', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findProductsPublic(
      undefined,
      undefined,
      undefined,
      undefined,
      5000,
    );

    expect(prisma.product.findMany.mock.calls[0][0].take).toBe(201);
  });

  it('never exposes cost, yield, BOM or margin on the public shape (CAT-03)', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findProductsPublic();

    const args = prisma.product.findMany.mock.calls[0][0];
    const serialised = JSON.stringify(args.include);
    for (const forbidden of [
      'computed_cost',
      'yield_qty',
      'yield_unit',
      'RecipeLines',
      'margin',
      'cost_per_unit',
      'stock_on_hand',
      'low_stock_threshold',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('leaves the staff list a bare array — the ops menu and POS read Product[]', async () => {
    prisma.product.findMany.mockResolvedValue([row('a')]);

    await expect(service.findProductsStaff()).resolves.toEqual([row('a')]);
  });
});

// -----------------------------------------------------------------
// Faceted search (SRCH-01)
// -----------------------------------------------------------------
describe('CatalogService.search — facets and cursor', () => {
  let service: CatalogService;
  const prisma = { $queryRaw: jest.fn() };

  /** Values interpolated into the tagged template, in order. */
  const valuesOf = (call: unknown[]) => call.slice(1);

  const hit = (id: string) => ({
    id,
    name: id,
    slug: id,
    type: 'packaged',
    base_price: 649,
    rating_avg: null,
    rating_count: 0,
    rank: 0.1,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        provideCatalogCache(),
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(CatalogService);
    jest.clearAllMocks();
  });

  it('short-circuits a blank q without touching the database', async () => {
    await expect(service.search('   ')).resolves.toEqual({
      items: [],
      facets: { types: [], categories: [] },
      next_cursor: null,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('passes the type and category filters through as bound parameters', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.search('coconut', 'packaged' as never, 'cat-1');

    const values = valuesOf(prisma.$queryRaw.mock.calls[0]);
    expect(values).toEqual([
      'coconut',
      'packaged',
      'packaged',
      'cat-1',
      'cat-1',
      'coconut',
      21,
      0,
    ]);
  });

  it('sends NULL for an absent filter so the predicate degrades to "no filter"', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.search('coconut');

    const values = valuesOf(prisma.$queryRaw.mock.calls[0]);
    expect(values[1]).toBeNull();
    expect(values[3]).toBeNull();
  });

  it('round-trips the cursor: a full page returns a base64 offset that becomes the next OFFSET', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([hit('a'), hit('b'), hit('c')])
      .mockResolvedValueOnce([]);

    const first = await service.search(
      'coconut',
      undefined,
      undefined,
      undefined,
      2,
    );

    expect(first.items).toHaveLength(2);
    expect(first.next_cursor).toBe(Buffer.from('2', 'utf8').toString('base64'));

    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.search(
      'coconut',
      undefined,
      undefined,
      first.next_cursor ?? undefined,
      2,
    );

    const values = valuesOf(prisma.$queryRaw.mock.calls[0]);
    expect(values[values.length - 1]).toBe(2);
  });

  it('returns next_cursor: null on the last page', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([hit('a')])
      .mockResolvedValueOnce([]);

    const page = await service.search(
      'coconut',
      undefined,
      undefined,
      undefined,
      2,
    );

    expect(page.next_cursor).toBeNull();
  });

  it('treats a hostile cursor as the first page', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.search('coconut', undefined, undefined, 'not-base64-🙂', 2);

    const values = valuesOf(prisma.$queryRaw.mock.calls[0]);
    expect(values[values.length - 1]).toBe(0);
  });

  it('aggregates facets across types AND categories from one grouped query', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([hit('a')]).mockResolvedValueOnce([
      { type: 'packaged', category_id: 'c1', name: 'Pantry', count: BigInt(3) },
      {
        type: 'merchandise',
        category_id: 'c1',
        name: 'Pantry',
        count: BigInt(1),
      },
      {
        type: 'packaged',
        category_id: 'c2',
        name: 'Gifting',
        count: BigInt(2),
      },
    ]);

    const page = await service.search('coconut');

    expect(page.facets.types).toEqual([
      { type: 'packaged', count: 5 },
      { type: 'merchandise', count: 1 },
    ]);
    expect(page.facets.categories).toEqual([
      { category_id: 'c1', name: 'Pantry', count: 4 },
      { category_id: 'c2', name: 'Gifting', count: 2 },
    ]);
  });

  it('keeps the facet query unfiltered by type so the counts stay narrowable', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.search('coconut', 'packaged' as never);

    // Only the search term is bound into the facet query.
    expect(valuesOf(prisma.$queryRaw.mock.calls[1])).toEqual(['coconut']);
  });

  it('keeps the GIN predicate byte-identical to the index expression', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.search('coconut');

    const sql = (prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain("to_tsvector('simple', p.search_text) @@");
  });

  it('clamps the search limit to 50', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.search('coconut', undefined, undefined, undefined, 900);

    const values = valuesOf(prisma.$queryRaw.mock.calls[0]);
    expect(values[values.length - 2]).toBe(51);
  });
});

// -----------------------------------------------------------------
// 60 s cache — key shape and invalidation
// -----------------------------------------------------------------
describe('CatalogService — catalog cache', () => {
  let service: CatalogService;
  const prisma = {
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productCategory: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productVariant: { upsert: jest.fn(), update: jest.fn() },
    productMedia: { create: jest.fn(), delete: jest.fn() },
    recipe: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        provideCatalogCache(),
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(CatalogService);
    jest.clearAllMocks();
  });

  it('keys the public list by every filter that changes the result', async () => {
    await service.findProductsPublic(
      'cat-1',
      'brand-1',
      'packaged' as never,
      'p-9',
      10,
    );

    expect(cache.wrap.mock.calls[0][0]).toBe(
      'products:cat-1:brand-1:packaged:p-9:10',
    );
  });

  it('keys categories by brand and the slug read by slug', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p-1',
      status: 'active',
    });

    await service.findCategories('brand-1');
    await service.findProductBySlug('coconut-oil');

    expect(cache.wrap.mock.calls[0][0]).toBe('categories:brand-1');
    expect(cache.wrap.mock.calls[1][0]).toBe('product:slug:coconut-oil');
  });

  it('does not cache a 404 for an unknown slug', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(service.findProductBySlug('ghost')).rejects.toThrow(
      /not found/,
    );
  });

  it('does not cache the staff list', async () => {
    await service.findProductsStaff();
    expect(cache.wrap).not.toHaveBeenCalled();
  });

  it('invalidates after every catalog write', async () => {
    prisma.product.create.mockResolvedValue({ id: 'p-1' });
    prisma.product.findUnique.mockResolvedValue({
      id: 'p-1',
      type: 'merchandise',
    });
    prisma.product.update.mockResolvedValue({ id: 'p-1', node_id: 'n-1' });
    prisma.productCategory.create.mockResolvedValue({ id: 'c-1' });
    prisma.productCategory.findUnique.mockResolvedValue({ id: 'c-1' });
    prisma.productCategory.update.mockResolvedValue({ id: 'c-1' });
    prisma.productVariant.upsert.mockResolvedValue({
      id: 'v-1',
      name: '500 ml',
      sku: 'KX-OIL-500',
      stock_on_hand: 9,
      low_stock_threshold: null,
      product: { id: 'p-1', node_id: 'n-1', name: 'Oil' },
    });
    prisma.productVariant.update.mockResolvedValue({ id: 'v-1' });
    prisma.productMedia.create.mockResolvedValue({ id: 'm-1' });
    prisma.productMedia.delete.mockResolvedValue({ id: 'm-1' });

    await service.createProduct({ type: 'merchandise' } as never, 'u-1');
    await service.updateProduct('p-1', { name: 'x' } as never, 'u-1');
    await service.setStatus('p-1', 'archived' as never, 'u-1');
    await service.createCategory({ name: 'Pantry' } as never);
    await service.updateCategory('c-1', { name: 'Pantry' } as never);
    await service.upsertVariant({ sku: 'KX-OIL-500' } as never);
    await service.removeVariant('v-1');
    await service.addMedia('p-1', { url: 'https://x/y.jpg' });
    await service.removeMedia('m-1');

    expect(cache.invalidate).toHaveBeenCalledTimes(9);
  });
});

// -----------------------------------------------------------------
// CAT-02 — stock.low from a variant edit
// -----------------------------------------------------------------
describe('CatalogService.upsertVariant — stock.low', () => {
  let service: CatalogService;
  const prisma = { productVariant: { upsert: jest.fn() } };

  const variant = (
    stock_on_hand: number,
    low_stock_threshold: number | null,
  ) => ({
    id: 'v-1',
    name: '500 ml',
    sku: 'KX-OIL-500',
    stock_on_hand,
    low_stock_threshold,
    product: { id: 'p-1', node_id: 'node-1', name: 'Cold-Pressed Coconut Oil' },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        provideCatalogCache(),
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(CatalogService);
    jest.clearAllMocks();
    emitter.emit.mockReturnValue(true);
  });

  it('emits when stock falls to the threshold, after the write', async () => {
    let written = false;
    prisma.productVariant.upsert.mockImplementation(async () => {
      written = true;
      return variant(5, 5);
    });
    emitter.emit.mockImplementation(() => {
      expect(written).toBe(true);
      return true;
    });

    await service.upsertVariant({ sku: 'KX-OIL-500' } as never, 'u-1');

    expect(emitter.emit).toHaveBeenCalledWith(
      DomainEvent.STOCK_LOW,
      expect.objectContaining({
        node_id: 'node-1',
        actor: { actor_type: 'user', actor_id: 'u-1' },
        occurred_at: expect.any(String),
        ingredientId: 'v-1',
        ingredientName: 'Cold-Pressed Coconut Oil — 500 ml (KX-OIL-500)',
        currentQty: 5,
        minQty: 5,
      }),
    );
  });

  it('emits when stock is below the threshold', async () => {
    prisma.productVariant.upsert.mockResolvedValue(variant(1, 5));

    await service.upsertVariant({ sku: 'KX-OIL-500' } as never);

    expect(emitter.emit).toHaveBeenCalledTimes(1);
  });

  it('stays silent above the threshold', async () => {
    prisma.productVariant.upsert.mockResolvedValue(variant(9, 5));

    await service.upsertVariant({ sku: 'KX-OIL-500' } as never);

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('stays silent when the variant carries no threshold', async () => {
    prisma.productVariant.upsert.mockResolvedValue(variant(0, null));

    await service.upsertVariant({ sku: 'KX-OIL-500' } as never);

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('attributes the signal to system when no staff actor is supplied', async () => {
    prisma.productVariant.upsert.mockResolvedValue(variant(0, 5));

    await service.upsertVariant({ sku: 'KX-OIL-500' } as never);

    expect(emitter.emit.mock.calls[0][1]).toMatchObject({
      actor: { actor_type: 'system', actor_id: null },
    });
  });

  it('still resolves when a listener throws', async () => {
    prisma.productVariant.upsert.mockResolvedValue(variant(0, 5));
    emitter.emit.mockImplementation(() => {
      throw new Error('listener exploded');
    });

    await expect(
      service.upsertVariant({ sku: 'KX-OIL-500' } as never),
    ).resolves.toMatchObject({ id: 'v-1' });
  });
});
