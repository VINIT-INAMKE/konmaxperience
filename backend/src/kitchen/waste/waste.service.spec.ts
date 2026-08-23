import { Test, TestingModule } from '@nestjs/testing';
import { WasteService } from './waste.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  mockEventEmitter,
  provideEventEmitter,
} from '../../test-utils/mock-providers';
import { DomainEvent } from '../../common/events/domain-events';

jest.mock('../../common/utils/unit-conversion', () => ({
  convertUnit: jest.fn(async (qty: number) => qty),
}));

const makeTx = () => ({
  wasteLog: { create: jest.fn() },
  stockMovement: { create: jest.fn().mockResolvedValue({}) },
  ingredientStock: {
    findFirst: jest.fn().mockResolvedValue({ current_quantity: 100 }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  prepBatch: { update: jest.fn().mockResolvedValue({}) },
});

const mockPrisma = {
  ingredient: {
    findUniqueOrThrow: jest
      .fn()
      .mockResolvedValue({ id: 'ing-1', base_unit: 'kg' }),
  },
  vendorPrice: { findFirst: jest.fn().mockResolvedValue(null) },
  prepBatch: { findUniqueOrThrow: jest.fn() },
  $transaction: jest.fn(),
};

const emitter = mockEventEmitter();

const ingredientWasteRow = {
  id: 'wl-1',
  node_id: 'node-1',
  waste_type: 'ingredient',
  reason: 'spoilage',
  cost_impact: '0',
  zone_id: 'zone-1',
  ingredient_id: 'ing-1',
  prep_batch_id: null,
};

describe('WasteService — waste.logged domain event (SPEC §4.1)', () => {
  let service: WasteService;
  let tx: ReturnType<typeof makeTx>;

  const ingredientDto = {
    waste_type: 'ingredient',
    ingredient_id: 'ing-1',
    zone_id: 'zone-1',
    quantity: 2,
    unit: 'kg',
    reason: 'spoilage',
  } as never;

  beforeEach(async () => {
    tx = makeTx();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WasteService,
        { provide: PrismaService, useValue: mockPrisma },
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(WasteService);
    jest.clearAllMocks();
    emitter.emit.mockReturnValue(true);
    mockPrisma.ingredient.findUniqueOrThrow.mockResolvedValue({
      id: 'ing-1',
      base_unit: 'kg',
    });
    mockPrisma.vendorPrice.findFirst.mockResolvedValue(null);
  });

  it('emits once, after the ingredient transaction resolves', async () => {
    let txResolved = false;
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const out = await cb(tx);
      txResolved = true;
      return out;
    });
    tx.wasteLog.create.mockResolvedValue(ingredientWasteRow);
    emitter.emit.mockImplementation(() => {
      expect(txResolved).toBe(true);
      return true;
    });

    await service.createWasteLog(ingredientDto, 'user-1');

    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith(
      DomainEvent.WASTE_LOGGED,
      expect.objectContaining({
        node_id: 'node-1',
        actor: { actor_type: 'user', actor_id: 'user-1' },
        occurred_at: expect.any(String),
        wasteLogId: 'wl-1',
        wasteType: 'ingredient',
        reason: 'spoilage',
        costImpact: '0',
        zoneId: 'zone-1',
        ingredientId: 'ing-1',
        prepBatchId: null,
      }),
    );
  });

  it('emits from the prep_batch branch too', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    mockPrisma.prepBatch.findUniqueOrThrow.mockResolvedValue({
      id: 'pb-1',
      unit: 'portion',
      quantity_produced: 10,
      quantity_remaining: 10,
      recipe: { computed_cost: 50, yield_qty: 10 },
    });
    tx.wasteLog.create.mockResolvedValue({
      ...ingredientWasteRow,
      id: 'wl-2',
      waste_type: 'prep_batch',
      ingredient_id: null,
      prep_batch_id: 'pb-1',
      cost_impact: '10',
    });

    await service.createWasteLog(
      {
        waste_type: 'prep_batch',
        prep_batch_id: 'pb-1',
        zone_id: 'zone-1',
        quantity: 2,
        unit: 'portion',
        reason: 'over_prep',
      } as never,
      'user-1',
    );

    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith(
      DomainEvent.WASTE_LOGGED,
      expect.objectContaining({
        wasteLogId: 'wl-2',
        wasteType: 'prep_batch',
        ingredientId: null,
        prepBatchId: 'pb-1',
      }),
    );
  });

  it('still resolves when the emitter throws', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    tx.wasteLog.create.mockResolvedValue(ingredientWasteRow);
    emitter.emit.mockImplementation(() => {
      throw new Error('listener exploded');
    });

    await expect(
      service.createWasteLog(ingredientDto, 'user-1'),
    ).resolves.toEqual(ingredientWasteRow);
  });
});
