import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrepBatchesService } from './prep-batches.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  mockEventEmitter,
  provideEventEmitter,
} from '../../test-utils/mock-providers';
import { DomainEvent } from '../../common/events/domain-events';

const emitter = mockEventEmitter();

// Mock convertUnit module
jest.mock('../../common/utils/unit-conversion', () => ({
  convertUnit: jest.fn(),
}));

import { convertUnit } from '../../common/utils/unit-conversion';
const mockConvertUnit = convertUnit as jest.MockedFunction<typeof convertUnit>;

/** Mock Prisma Decimal — supports Number() via valueOf() */
const dec = (n: number) => ({ valueOf: () => n, toNumber: () => n });

// Build a mock transaction object that mirrors Prisma client
const createMockTx = () => ({
  recipe: {
    findUnique: jest.fn(),
  },
  prepBatch: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  ingredientStock: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  stockMovement: {
    create: jest.fn(),
  },
});

const mockPrisma = {
  prepBatch: {
    findMany: jest.fn(),
  },
  recipe: {
    findUnique: jest.fn(),
  },
  ingredientStock: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('PrepBatchesService', () => {
  let service: PrepBatchesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrepBatchesService,
        { provide: PrismaService, useValue: mockPrisma },
        provideEventEmitter(emitter),
      ],
    }).compile();

    service = module.get<PrepBatchesService>(PrepBatchesService);
    jest.clearAllMocks();
    emitter.emit.mockReturnValue(true);
    // Default: convertUnit returns qty as-is (same unit)
    mockConvertUnit.mockImplementation(async (qty) => qty);
  });

  describe('createPrepBatch', () => {
    const userId = 'user-1';
    const dto = {
      recipe_id: 'recipe-1',
      zone_id: 'zone-1',
      quantity_to_prep: 2,
    };

    it('deducts raw ingredient stock and creates StockMovement with type=prep_deducted', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const recipe = {
        id: 'recipe-1',
        yield_qty: dec(1),
        yield_unit: 'portions',
        shelf_life_hours: 24,
        RecipeLines: [
          {
            input_type: 'ingredient',
            ingredient_id: 'ing-1',
            source_recipe_id: null,
            quantity: dec(100),
            unit: 'g',
            ingredient: { id: 'ing-1', name: 'Flour', base_unit: 'g' },
            source_recipe: null,
          },
        ],
      };
      mockTx.recipe.findUnique.mockResolvedValue(recipe);
      mockTx.ingredientStock.findUnique.mockResolvedValue({
        current_quantity: dec(500),
      });
      mockTx.ingredientStock.update.mockResolvedValue({});
      mockTx.stockMovement.create.mockResolvedValue({});

      const createdBatch = {
        id: 'batch-1',
        recipe: { name: 'Test' },
        zone: { name: 'Kitchen' },
      };
      mockTx.prepBatch.create.mockResolvedValue(createdBatch);

      const result = await service.createPrepBatch(dto, userId);

      expect(result).toEqual(createdBatch);
      // Should decrement stock: 100g * 2 (multiplier) = 200g
      expect(mockTx.ingredientStock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { current_quantity: { decrement: 200 } },
        }),
      );
      // Should create StockMovement with prep_deducted
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movement_type: 'prep_deducted',
            quantity: -200,
            reference_type: 'prep_batch',
            reference_id: 'batch-1',
          }),
        }),
      );
    });

    it('deducts from multiple PrepBatches in FIFO order (oldest first)', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const recipe = {
        id: 'recipe-1',
        yield_qty: dec(1),
        yield_unit: 'portions',
        shelf_life_hours: null,
        RecipeLines: [
          {
            input_type: 'recipe',
            ingredient_id: null,
            source_recipe_id: 'sub-recipe-1',
            quantity: dec(50),
            unit: 'ml',
            ingredient: null,
            source_recipe: {
              id: 'sub-recipe-1',
              name: 'Sauce',
              yield_unit: 'ml',
            },
          },
        ],
      };
      mockTx.recipe.findUnique.mockResolvedValue(recipe);

      // Two FIFO batches: oldest has 30ml, newest has 100ml
      // Need 50 * 2 = 100ml total
      const batch1 = {
        id: 'old-batch',
        quantity_remaining: dec(30),
        unit: 'ml',
        created_at: new Date('2026-01-01'),
      };
      const batch2 = {
        id: 'new-batch',
        quantity_remaining: dec(100),
        unit: 'ml',
        created_at: new Date('2026-01-02'),
      };
      mockTx.prepBatch.findMany.mockResolvedValue([batch1, batch2]);
      mockTx.prepBatch.update.mockResolvedValue({});

      const createdBatch = {
        id: 'batch-1',
        recipe: { name: 'Test' },
        zone: { name: 'Kitchen' },
      };
      mockTx.prepBatch.create.mockResolvedValue(createdBatch);

      await service.createPrepBatch(dto, userId);

      // First batch should be fully depleted (30ml deducted)
      expect(mockTx.prepBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'old-batch' },
          data: expect.objectContaining({
            quantity_remaining: { decrement: 30 },
            status: 'depleted',
          }),
        }),
      );
      // Second batch should have 70ml deducted (remaining need: 100 - 30 = 70)
      expect(mockTx.prepBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'new-batch' },
          data: expect.objectContaining({
            quantity_remaining: { decrement: 70 },
          }),
        }),
      );
      // Verify order: old-batch updated first
      const updateCalls = mockTx.prepBatch.update.mock.calls;
      expect(updateCalls[0][0].where.id).toBe('old-batch');
      expect(updateCalls[1][0].where.id).toBe('new-batch');
    });

    it('marks PrepBatch as depleted when quantity_remaining reaches 0', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const recipe = {
        id: 'recipe-1',
        yield_qty: dec(1),
        yield_unit: 'portions',
        shelf_life_hours: null,
        RecipeLines: [
          {
            input_type: 'recipe',
            ingredient_id: null,
            source_recipe_id: 'sub-recipe-1',
            quantity: dec(50),
            unit: 'ml',
            ingredient: null,
            source_recipe: {
              id: 'sub-recipe-1',
              name: 'Sauce',
              yield_unit: 'ml',
            },
          },
        ],
      };
      mockTx.recipe.findUnique.mockResolvedValue(recipe);

      // Single batch with exactly enough (100ml = 50*2)
      const batch = {
        id: 'exact-batch',
        quantity_remaining: dec(100),
        unit: 'ml',
        created_at: new Date(),
      };
      mockTx.prepBatch.findMany.mockResolvedValue([batch]);
      mockTx.prepBatch.update.mockResolvedValue({});

      const createdBatch = {
        id: 'batch-1',
        recipe: { name: 'Test' },
        zone: { name: 'Kitchen' },
      };
      mockTx.prepBatch.create.mockResolvedValue(createdBatch);

      await service.createPrepBatch(dto, userId);

      expect(mockTx.prepBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'depleted',
          }),
        }),
      );
    });

    it('throws BadRequestException when raw ingredient stock insufficient', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const recipe = {
        id: 'recipe-1',
        yield_qty: dec(1),
        yield_unit: 'portions',
        shelf_life_hours: null,
        RecipeLines: [
          {
            input_type: 'ingredient',
            ingredient_id: 'ing-1',
            source_recipe_id: null,
            quantity: dec(100),
            unit: 'g',
            ingredient: { id: 'ing-1', name: 'Flour', base_unit: 'g' },
            source_recipe: null,
          },
        ],
      };
      mockTx.recipe.findUnique.mockResolvedValue(recipe);
      // Only 50g available, need 200g (100 * 2 multiplier)
      mockTx.ingredientStock.findUnique.mockResolvedValue({
        current_quantity: dec(50),
      });

      mockTx.prepBatch.create.mockResolvedValue({ id: 'batch-1' });

      await expect(service.createPrepBatch(dto, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createPrepBatch(dto, userId)).rejects.toThrow(
        /Insufficient stock for Flour/,
      );
    });

    it('throws BadRequestException when sub-recipe prep batch stock insufficient', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const recipe = {
        id: 'recipe-1',
        yield_qty: dec(1),
        yield_unit: 'portions',
        shelf_life_hours: null,
        RecipeLines: [
          {
            input_type: 'recipe',
            ingredient_id: null,
            source_recipe_id: 'sub-recipe-1',
            quantity: dec(50),
            unit: 'ml',
            ingredient: null,
            source_recipe: {
              id: 'sub-recipe-1',
              name: 'Sauce',
              yield_unit: 'ml',
            },
          },
        ],
      };
      mockTx.recipe.findUnique.mockResolvedValue(recipe);

      // Only 20ml available in batches, need 100ml
      const batch = {
        id: 'small-batch',
        quantity_remaining: dec(20),
        unit: 'ml',
        created_at: new Date(),
      };
      mockTx.prepBatch.findMany.mockResolvedValue([batch]);
      mockTx.prepBatch.update.mockResolvedValue({});

      mockTx.prepBatch.create.mockResolvedValue({ id: 'batch-1' });

      await expect(service.createPrepBatch(dto, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createPrepBatch(dto, userId)).rejects.toThrow(
        /Insufficient prep batch stock for Sauce/,
      );
    });

    it('excludes expired PrepBatches from FIFO candidates', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const recipe = {
        id: 'recipe-1',
        yield_qty: dec(1),
        yield_unit: 'portions',
        shelf_life_hours: null,
        RecipeLines: [
          {
            input_type: 'recipe',
            ingredient_id: null,
            source_recipe_id: 'sub-recipe-1',
            quantity: dec(10),
            unit: 'ml',
            ingredient: null,
            source_recipe: {
              id: 'sub-recipe-1',
              name: 'Sauce',
              yield_unit: 'ml',
            },
          },
        ],
      };
      mockTx.recipe.findUnique.mockResolvedValue(recipe);

      // Return fresh batch only (expired ones excluded by WHERE clause)
      const freshBatch = {
        id: 'fresh',
        quantity_remaining: dec(100),
        unit: 'ml',
        created_at: new Date(),
      };
      mockTx.prepBatch.findMany.mockResolvedValue([freshBatch]);
      mockTx.prepBatch.update.mockResolvedValue({});

      const createdBatch = {
        id: 'batch-1',
        recipe: { name: 'Test' },
        zone: { name: 'Kitchen' },
      };
      mockTx.prepBatch.create.mockResolvedValue(createdBatch);

      await service.createPrepBatch(dto, userId);

      // Verify findMany includes the expires_at OR filter
      const findManyCall = mockTx.prepBatch.findMany.mock.calls[0][0];
      expect(findManyCall.where).toEqual(
        expect.objectContaining({
          recipe_id: 'sub-recipe-1',
          status: 'active',
          OR: expect.arrayContaining([
            { expires_at: null },
            expect.objectContaining({
              expires_at: expect.objectContaining({ gt: expect.any(Date) }),
            }),
          ]),
        }),
      );
      expect(findManyCall.orderBy).toEqual({ created_at: 'asc' });
    });
  });

  describe('previewDeductions', () => {
    it('returns correct available/required/sufficient for each BOM line without modifying data', async () => {
      const dto = {
        recipe_id: 'recipe-1',
        zone_id: 'zone-1',
        quantity_to_prep: 2,
      };

      const recipe = {
        id: 'recipe-1',
        yield_qty: dec(1),
        yield_unit: 'portions',
        RecipeLines: [
          {
            input_type: 'ingredient',
            ingredient_id: 'ing-1',
            source_recipe_id: null,
            quantity: dec(100),
            unit: 'g',
            ingredient: { id: 'ing-1', name: 'Flour', base_unit: 'g' },
            source_recipe: null,
          },
          {
            input_type: 'recipe',
            ingredient_id: null,
            source_recipe_id: 'sub-recipe-1',
            quantity: dec(50),
            unit: 'ml',
            ingredient: null,
            source_recipe: {
              id: 'sub-recipe-1',
              name: 'Sauce',
              yield_unit: 'ml',
            },
          },
        ],
      };

      // Preview uses this.prisma directly, not tx
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);
      mockPrisma.ingredientStock.findMany.mockResolvedValue([
        { ingredient_id: 'ing-1', current_quantity: dec(300) },
      ]);
      mockPrisma.prepBatch.findMany.mockResolvedValue([
        { recipe_id: 'sub-recipe-1', quantity_remaining: dec(40) },
        { recipe_id: 'sub-recipe-1', quantity_remaining: dec(80) },
      ]);

      const result = await service.previewDeductions(dto);

      expect(result).toHaveLength(2);

      // Ingredient line: need 200g (100*2), have 300g -> sufficient
      expect(result[0]).toEqual(
        expect.objectContaining({
          input_name: 'Flour',
          input_type: 'ingredient',
          available: 300,
          required: 200,
          unit: 'g',
          sufficient: true,
        }),
      );

      // Recipe line: need 100ml (50*2), have 120ml (40+80) -> sufficient
      expect(result[1]).toEqual(
        expect.objectContaining({
          input_name: 'Sauce',
          input_type: 'recipe',
          available: 120,
          required: 100,
          unit: 'ml',
          sufficient: true,
        }),
      );

      // Verify no $transaction was called (read-only)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // prep_batch.created / prep_batch.depleted domain events (SPEC §4.1)
  // ---------------------------------------------------------------
  describe('domain events', () => {
    const userId = 'user-1';
    const dto = {
      recipe_id: 'recipe-1',
      zone_id: 'zone-1',
      quantity_to_prep: 2,
    };
    const createdBatch = {
      id: 'batch-1',
      node_id: 'node-1',
      recipe_id: 'recipe-1',
      zone_id: 'zone-1',
      // Prisma Decimal stringifies to its digits; `dec()` here is number-only.
      quantity_produced: '2',
      unit: 'portions',
      recipe: { name: 'Test' },
      zone: { name: 'Kitchen' },
    };

    /** A recipe whose only BOM line consumes a sub-recipe batch to exhaustion. */
    const arrangeSubRecipeExhaustion = (
      mockTx: ReturnType<typeof createMockTx>,
    ) => {
      mockTx.recipe.findUnique.mockResolvedValue({
        id: 'recipe-1',
        yield_qty: dec(1),
        yield_unit: 'portions',
        shelf_life_hours: null,
        RecipeLines: [
          {
            input_type: 'recipe',
            ingredient_id: null,
            source_recipe_id: 'sub-recipe-1',
            quantity: dec(50),
            unit: 'ml',
            ingredient: null,
            source_recipe: {
              id: 'sub-recipe-1',
              name: 'Sauce',
              yield_unit: 'ml',
            },
          },
        ],
      });
      mockTx.prepBatch.findMany.mockResolvedValue([
        {
          id: 'exact-batch',
          node_id: 'node-2',
          quantity_remaining: dec(100),
          unit: 'ml',
          created_at: new Date(),
        },
      ]);
      mockTx.prepBatch.update.mockResolvedValue({});
      mockTx.prepBatch.create.mockResolvedValue(createdBatch);
    };

    it('emits prep_batch.created once, after the transaction resolves', async () => {
      const mockTx = createMockTx();
      let txResolved = false;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const out = await cb(mockTx);
        txResolved = true;
        return out;
      });
      mockTx.recipe.findUnique.mockResolvedValue({
        id: 'recipe-1',
        yield_qty: dec(1),
        yield_unit: 'portions',
        shelf_life_hours: null,
        RecipeLines: [],
      });
      mockTx.prepBatch.create.mockResolvedValue(createdBatch);
      emitter.emit.mockImplementation(() => {
        expect(txResolved).toBe(true);
        return true;
      });

      await service.createPrepBatch(dto, userId);

      expect(emitter.emit).toHaveBeenCalledTimes(1);
      expect(emitter.emit).toHaveBeenCalledWith(
        DomainEvent.PREP_BATCH_CREATED,
        expect.objectContaining({
          node_id: 'node-1',
          actor: { actor_type: 'user', actor_id: userId },
          occurred_at: expect.any(String),
          prepBatchId: 'batch-1',
          recipeId: 'recipe-1',
          recipeName: 'Test',
          zoneId: 'zone-1',
          quantityProduced: '2',
          unit: 'portions',
        }),
      );
    });

    it('emits prep_batch.depleted per exhausted sub-recipe batch, after commit', async () => {
      const mockTx = createMockTx();
      let txResolved = false;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const out = await cb(mockTx);
        txResolved = true;
        return out;
      });
      arrangeSubRecipeExhaustion(mockTx);
      emitter.emit.mockImplementation(() => {
        expect(txResolved).toBe(true);
        return true;
      });

      await service.createPrepBatch(dto, userId);

      expect(emitter.emit).toHaveBeenCalledTimes(2);
      expect(emitter.emit).toHaveBeenNthCalledWith(
        2,
        DomainEvent.PREP_BATCH_DEPLETED,
        expect.objectContaining({
          node_id: 'node-2',
          actor: { actor_type: 'user', actor_id: userId },
          occurred_at: expect.any(String),
          prepBatchId: 'exact-batch',
          recipeId: 'sub-recipe-1',
          recipeName: 'Sauce',
          zoneId: 'zone-1',
        }),
      );
    });

    it('still resolves when the emitter throws', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
      arrangeSubRecipeExhaustion(mockTx);
      emitter.emit.mockImplementation(() => {
        throw new Error('listener exploded');
      });

      await expect(service.createPrepBatch(dto, userId)).resolves.toEqual(
        createdBatch,
      );
    });
  });
});
