import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

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
      providers: [CatalogService, { provide: PrismaService, useValue: prisma }],
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
      providers: [CatalogService, { provide: PrismaService, useValue: prisma }],
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
      providers: [CatalogService, { provide: PrismaService, useValue: prisma }],
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
