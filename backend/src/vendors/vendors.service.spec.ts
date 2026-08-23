import { Test, TestingModule } from '@nestjs/testing';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../prisma/prisma.service';
import { CostCalculatorService } from '../recipes/cost-calculator.service';
import {
  mockEventEmitter,
  provideEventEmitter,
} from '../test-utils/mock-providers';
import { DomainEvent } from '../common/events/domain-events';

const mockPrisma = {
  vendorPrice: { create: jest.fn() },
};
const mockCostCalculator = { recalculateForIngredient: jest.fn() };
const emitter = mockEventEmitter();

const createdPrice = {
  id: 'vp-1',
  vendor_id: 'v-1',
  ingredient_id: 'ing-1',
  price: '95.50',
  unit: 'kg',
  ingredient: { id: 'ing-1', name: 'Basmati Rice', base_unit: 'kg' },
  vendor: { id: 'v-1', name: 'Green Farms', node_id: 'node-1' },
};

const dto = {
  vendor_id: 'v-1',
  ingredient_id: 'ing-1',
  price: 95.5,
  unit: 'kg',
  effective_date: '2026-08-23',
} as never;

describe('VendorsService — vendor_price.updated domain event (SPEC §4.1)', () => {
  let service: VendorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CostCalculatorService, useValue: mockCostCalculator },
        provideEventEmitter(emitter),
      ],
    }).compile();
    service = module.get(VendorsService);
    jest.clearAllMocks();
    emitter.emit.mockReturnValue(true);
    mockCostCalculator.recalculateForIngredient.mockResolvedValue(undefined);
    mockPrisma.vendorPrice.create.mockResolvedValue(createdPrice);
  });

  it('emits once, after the write and the cost recalculation have landed', async () => {
    let recalculated = false;
    mockCostCalculator.recalculateForIngredient.mockImplementation(async () => {
      recalculated = true;
    });
    emitter.emit.mockImplementation(() => {
      expect(recalculated).toBe(true);
      return true;
    });

    await service.addPrice(dto);

    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith(
      DomainEvent.VENDOR_PRICE_UPDATED,
      expect.objectContaining({
        // VendorPrice has no node_id of its own — the vendor's node owns it.
        node_id: 'node-1',
        actor: { actor_type: 'system', actor_id: null },
        occurred_at: expect.any(String),
        vendorPriceId: 'vp-1',
        vendorId: 'v-1',
        ingredientId: 'ing-1',
        ingredientName: 'Basmati Rice',
        price: '95.50',
        unit: 'kg',
      }),
    );
  });

  it('still resolves when the emitter throws', async () => {
    emitter.emit.mockImplementation(() => {
      throw new Error('listener exploded');
    });

    await expect(service.addPrice(dto)).resolves.toEqual(createdPrice);
  });
});
