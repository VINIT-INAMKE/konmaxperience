import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  mockEventEmitter,
  provideEventEmitter,
} from '../test-utils/mock-providers';
import { DomainEvent } from '../common/events/domain-events';
import { DEFAULT_NODE_ID } from '../node/node.constants';

jest.mock('../common/utils/unit-conversion', () => ({
  convertUnit: jest.fn(async (qty: number) => qty),
}));

const makeTx = () => ({
  ingredient: {
    findUniqueOrThrow: jest
      .fn()
      .mockResolvedValue({ id: 'ing-1', base_unit: 'kg' }),
  },
  ingredientStock: {
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
  },
  stockMovement: { create: jest.fn().mockResolvedValue({}) },
});

const mockPrisma = {
  ingredientStock: { findMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
};

const emitter = mockEventEmitter();

/** A stock row already below its ingredient's reorder point. */
const lowStock = {
  ingredient_id: 'ing-1',
  zone_id: 'zone-1',
  current_quantity: 2,
  ingredient: {
    id: 'ing-1',
    name: 'Basmati Rice',
    base_unit: 'kg',
    min_stock_level: 10,
  },
  zone: { id: 'zone-1', name: 'Main Kitchen' },
};

describe('InventoryService — stock.low domain event (SPEC §4.1)', () => {
  let service: InventoryService;
  let tx: ReturnType<typeof makeTx>;

  // A positive adjustment keeps the sufficiency pre-check out of the way, so
  // `findUnique` is called exactly once — for the post-write stock row.
  const dto = {
    ingredient_id: 'ing-1',
    zone_id: 'zone-1',
    quantity: 5,
    unit: 'kg',
    reason: 'recount',
  } as never;

  beforeEach(async () => {
    tx = makeTx();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(InventoryService);
    jest.clearAllMocks();
    emitter.emit.mockReturnValue(true);
  });

  it('emits once, after the transaction resolves, with the typed payload', async () => {
    let txResolved = false;
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const out = await cb(tx);
      txResolved = true;
      return out;
    });
    tx.ingredientStock.findUnique.mockResolvedValue(lowStock);
    emitter.emit.mockImplementation(() => {
      expect(txResolved).toBe(true);
      return true;
    });

    await service.adjust(dto, 'user-1');

    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith(
      DomainEvent.STOCK_LOW,
      expect.objectContaining({
        // IngredientStock carries no node_id, so the default node is used.
        node_id: DEFAULT_NODE_ID,
        actor: { actor_type: 'system', actor_id: null },
        occurred_at: expect.any(String),
        ingredientId: 'ing-1',
        ingredientName: 'Basmati Rice',
        currentQty: 2,
        minQty: 10,
        unit: 'kg',
        zoneId: 'zone-1',
      }),
    );
  });

  it('emits nothing while the stock is still above its minimum', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    tx.ingredientStock.findUnique.mockResolvedValue({
      ...lowStock,
      current_quantity: 25,
    });

    await service.adjust(dto, 'user-1');

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('still resolves when the emitter throws', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    tx.ingredientStock.findUnique.mockResolvedValue(lowStock);
    emitter.emit.mockImplementation(() => {
      throw new Error('listener exploded');
    });

    await expect(service.adjust(dto, 'user-1')).resolves.toEqual(lowStock);
  });
});
