import { Test, TestingModule } from '@nestjs/testing';
import { PickAndPackService } from './pick-and-pack.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { REALTIME_EVENTS } from '../../realtime/realtime.channels';

describe('PickAndPackService', () => {
  let service: PickAndPackService;
  const prisma = {
    order: { findMany: jest.fn().mockResolvedValue([]) },
    orderItem: { update: jest.fn() },
  };
  const realtime = { emit: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PickAndPackService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();
    service = module.get(PickAndPackService);
    jest.clearAllMocks();
  });

  it('pushes pickpack.order.updated after an item is picked', async () => {
    prisma.orderItem.update.mockResolvedValue({
      id: 'oi-1',
      order_id: 'order-1',
    });

    const result = await service.markItemPicked('oi-1');

    expect(result).toEqual({ id: 'oi-1', order_id: 'order-1' });
    expect(realtime.emit).toHaveBeenCalledWith(
      'private-pick-pack',
      REALTIME_EVENTS.PICK_PACK_ORDER_UPDATED,
      { item_id: 'oi-1', order_id: 'order-1' },
    );
  });

  it('lists only placed and preparing orders (real Order.status values)', async () => {
    await service.getActiveOrders();

    const calls = prisma.order.findMany.mock.calls as Array<
      [{ where: { status: unknown } }]
    >;
    const call = calls[0][0];
    expect(call.where.status).toEqual({ in: ['placed', 'preparing'] });
  });
});
