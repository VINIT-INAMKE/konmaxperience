import { Test, TestingModule } from '@nestjs/testing';
import { PickAndPackService } from './pick-and-pack.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PickAndPackService', () => {
  let service: PickAndPackService;
  const prisma = {
    order: { findMany: jest.fn().mockResolvedValue([]) },
    orderItem: { update: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PickAndPackService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(PickAndPackService);
    jest.clearAllMocks();
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
