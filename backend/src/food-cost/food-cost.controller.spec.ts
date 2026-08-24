import { Test, TestingModule } from '@nestjs/testing';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { FoodCostController } from './food-cost.controller';
import { FoodCostService } from './food-cost.service';

describe('FoodCostController', () => {
  let controller: FoodCostController;
  const service = { report: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FoodCostController],
      providers: [{ provide: FoodCostService, useValue: service }],
    }).compile();
    controller = module.get(FoodCostController);
    jest.clearAllMocks();
    service.report.mockResolvedValue({ from: 'x', to: 'y' });
  });

  it('is mounted at analytics/food-cost, beside the other analytics routes', () => {
    expect(Reflect.getMetadata('path', FoodCostController)).toBe(
      'analytics/food-cost',
    );
  });

  it('requires MANAGE_KPIS, the permission every analytics route already uses', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        FoodCostController.prototype.getFoodCost,
      ),
    ).toBe(Permission.MANAGE_KPIS);
  });

  it('passes the window through verbatim, leaving the default to the service', async () => {
    await controller.getFoodCost({ from: '2026-03-01', to: '2026-03-31' });
    expect(service.report).toHaveBeenCalledWith('2026-03-01', '2026-03-31');

    await controller.getFoodCost({});
    expect(service.report).toHaveBeenLastCalledWith(undefined, undefined);
  });
});
