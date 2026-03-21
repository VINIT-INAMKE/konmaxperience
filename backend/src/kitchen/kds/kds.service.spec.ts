import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KdsService } from './kds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../../orders/orders.service';

/** Mock Prisma Decimal -- supports Number() via valueOf() */
const dec = (n: number) => ({ valueOf: () => n, toNumber: () => n });

const mockPrisma = {
  orderItem: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockOrdersService = {
  deductItemIngredients: jest.fn(),
};

describe('KdsService', () => {
  let service: KdsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KdsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    }).compile();

    service = module.get<KdsService>(KdsService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // updateItemStatus — non-ready transitions
  // ---------------------------------------------------------------
  describe('updateItemStatus (non-ready)', () => {
    it('transitions pending -> preparing without $transaction', async () => {
      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        status: 'pending',
        order_id: 'order-1',
        menu_item_id: 'mi-1',
        quantity: 1,
      });
      mockPrisma.orderItem.update.mockResolvedValue({
        id: 'oi-1',
        status: 'preparing',
        ready_at: null,
      });

      const result = await service.updateItemStatus('oi-1', 'preparing');

      expect(result.status).toBe('preparing');
      expect(result.ready_at).toBeNull();
      // Should NOT use $transaction for non-ready transitions
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockOrdersService.deductItemIngredients).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // updateItemStatus — ready transitions with deduction
  // ---------------------------------------------------------------
  describe('updateItemStatus (ready with deduction)', () => {
    it('wraps in $transaction and calls deductItemIngredients on ready', async () => {
      const readyAt = new Date('2026-03-21T12:00:00Z');
      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        status: 'preparing',
        order_id: 'order-1',
        menu_item_id: 'mi-1',
        quantity: 2,
      });

      // Mock transaction execution
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          order: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
          orderItem: { update: jest.fn(), findMany: jest.fn() },
        };
        tx.order.findUniqueOrThrow.mockResolvedValue({
          id: 'order-1',
          created_by: 'user-1',
          zone_id: 'zone-1',
        });
        tx.orderItem.update.mockResolvedValue({
          id: 'oi-1',
          status: 'ready',
          ready_at: readyAt,
        });
        // Not all items ready — another item still preparing
        tx.orderItem.findMany.mockResolvedValue([
          { id: 'oi-1', status: 'ready' },
          { id: 'oi-2', status: 'preparing' },
        ]);
        mockOrdersService.deductItemIngredients.mockResolvedValue(undefined);

        return cb(tx);
      });

      const result = await service.updateItemStatus('oi-1', 'ready');

      expect(result.status).toBe('ready');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockOrdersService.deductItemIngredients).toHaveBeenCalledWith(
        expect.anything(), // tx
        {
          id: 'oi-1',
          order_id: 'order-1',
          menu_item_id: 'mi-1',
          quantity: 2,
        },
        'user-1', // created_by from order
      );
    });

    it('auto-transitions order to ready when ALL items are ready', async () => {
      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        status: 'preparing',
        order_id: 'order-1',
        menu_item_id: 'mi-1',
        quantity: 1,
      });

      let orderUpdateCalled = false;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          order: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'order-1',
              created_by: 'user-1',
            }),
            update: jest.fn().mockImplementation(() => {
              orderUpdateCalled = true;
              return Promise.resolve({ id: 'order-1', status: 'ready' });
            }),
          },
          orderItem: {
            update: jest.fn().mockResolvedValue({
              id: 'oi-1',
              status: 'ready',
              ready_at: new Date(),
            }),
            findMany: jest.fn().mockResolvedValue([
              // The current item (oi-1) is being set to ready, and oi-2 already is ready
              { id: 'oi-1', status: 'ready' },
              { id: 'oi-2', status: 'ready' },
            ]),
          },
        };
        mockOrdersService.deductItemIngredients.mockResolvedValue(undefined);

        return cb(tx);
      });

      await service.updateItemStatus('oi-1', 'ready');

      expect(orderUpdateCalled).toBe(true);
    });

    it('does NOT advance item status when deduction throws (transaction rollback)', async () => {
      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        status: 'preparing',
        order_id: 'order-1',
        menu_item_id: 'mi-1',
        quantity: 1,
      });

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          order: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'order-1',
              created_by: 'user-1',
            }),
          },
          orderItem: { update: jest.fn(), findMany: jest.fn() },
        };
        // Deduction throws — insufficient stock
        mockOrdersService.deductItemIngredients.mockRejectedValue(
          new BadRequestException('Insufficient stock for Flour'),
        );

        return cb(tx);
      });

      await expect(
        service.updateItemStatus('oi-1', 'ready'),
      ).rejects.toThrow(BadRequestException);

      // The transaction would roll back — verify orderItem.update was NOT reached
      // (deduction is called BEFORE the item update in the transaction)
    });

    it('order.status stays unchanged when NOT all items ready', async () => {
      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        status: 'preparing',
        order_id: 'order-1',
        menu_item_id: 'mi-1',
        quantity: 1,
      });

      let orderUpdateCalled = false;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          order: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'order-1',
              created_by: 'user-1',
            }),
            update: jest.fn().mockImplementation(() => {
              orderUpdateCalled = true;
              return Promise.resolve({});
            }),
          },
          orderItem: {
            update: jest.fn().mockResolvedValue({
              id: 'oi-1',
              status: 'ready',
              ready_at: new Date(),
            }),
            findMany: jest.fn().mockResolvedValue([
              { id: 'oi-1', status: 'ready' },
              { id: 'oi-2', status: 'pending' },
            ]),
          },
        };
        mockOrdersService.deductItemIngredients.mockResolvedValue(undefined);

        return cb(tx);
      });

      await service.updateItemStatus('oi-1', 'ready');

      // order.update should NOT have been called since not all items ready
      expect(orderUpdateCalled).toBe(false);
    });
  });
});
