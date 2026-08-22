import { Test, TestingModule } from '@nestjs/testing';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../common/utils/unit-conversion', () => ({
  convertUnit: jest.fn((qty: number, from: string, to: string) => {
    if (from === to) return Promise.resolve(qty);
    if (from === 'kg' && to === 'g') return Promise.resolve(qty * 1000);
    return Promise.resolve(null);
  }),
}));

const dec = (n: number) => ({ valueOf: () => n, toNumber: () => n });

const assembleItem = (lineUnit: string) => ({
  id: 'mi-1',
  available: true,
  status: 'active',
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

describe('MenuService.computeServings (assemble)', () => {
  let service: MenuService;
  const prisma = {
    menuItem: { findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    ingredientStock: { findMany: jest.fn() },
    prepBatch: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MenuService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(MenuService);
    jest.clearAllMocks();
    prisma.ingredientStock.findMany.mockResolvedValue([
      { ingredient_id: 'ing-1', current_quantity: dec(2000) },
    ]);
    prisma.prepBatch.findMany.mockResolvedValue([
      { recipe_id: 'sr-1', quantity_remaining: dec(10) },
    ]);
  });

  it('converts line units to the stock base unit (0.5 kg per serving, 2000 g in stock -> 4)', async () => {
    prisma.menuItem.findMany.mockResolvedValue([assembleItem('kg')]);

    const result = await service.getAllServingsAvailable();

    expect(result['mi-1']).toEqual({
      available: true,
      servings_remaining: 4,
      preparation_type: 'assemble',
    });
  });

  it('is unavailable when a line has no unit conversion', async () => {
    prisma.menuItem.findMany.mockResolvedValue([assembleItem('lb')]);

    const result = await service.getAllServingsAvailable();

    expect(result['mi-1']).toEqual({
      available: false,
      servings_remaining: 0,
      preparation_type: 'assemble',
    });
  });

  it('single-item path queries stock and batches instead of returning 0', async () => {
    prisma.menuItem.findUniqueOrThrow.mockResolvedValue(assembleItem('kg'));

    const result = await service.getServingsAvailable('mi-1');

    expect(result.servings_remaining).toBe(4);
    expect(prisma.ingredientStock.findMany).toHaveBeenCalledWith({
      where: { ingredient_id: 'ing-1' },
    });
  });
});
