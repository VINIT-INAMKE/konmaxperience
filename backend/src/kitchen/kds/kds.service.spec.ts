import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KdsService } from './kds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FulfilmentService } from '../../fulfilment/fulfilment.service';
import { DomainEvent } from '../../common/events/domain-events';

const mockPrisma = {
  orderItem: { findUnique: jest.fn(), update: jest.fn() },
  order: { findMany: jest.fn() },
  $transaction: jest.fn(),
};
const mockFulfilment = { deductItemIngredients: jest.fn() };
const mockEmitter = { emit: jest.fn() };

const makeTx = (opts: { notReadyCount: number; zone_id?: string | null }) => ({
  orderItem: {
    findUnique: jest.fn().mockResolvedValue({
      id: 'oi-1',
      status: 'preparing',
      order_id: 'order-1',
      product_id: 'mi-1',
      quantity: 2,
    }),
    update: jest.fn().mockResolvedValue({
      id: 'oi-1',
      status: 'ready',
      ready_at: new Date('2026-03-21T12:00:00Z'),
    }),
    count: jest.fn().mockResolvedValue(opts.notReadyCount),
  },
  order: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({
      id: 'order-1',
      node_id: 'node-1',
      channel: 'dine_in',
      created_by: 'user-1',
      customer_id: null,
      zone_id: opts.zone_id === undefined ? 'zone-1' : opts.zone_id,
    }),
    update: jest.fn().mockResolvedValue({ id: 'order-1', status: 'ready' }),
  },
});

describe('KdsService', () => {
  let service: KdsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KdsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FulfilmentService, useValue: mockFulfilment },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<KdsService>(KdsService);
    jest.clearAllMocks();
    mockEmitter.emit.mockImplementation(() => true);
    mockFulfilment.deductItemIngredients.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------
  // updateItemStatus — non-ready transitions
  // ---------------------------------------------------------------
  it('pending -> preparing runs in a transaction without deduction', async () => {
    const tx = makeTx({ notReadyCount: 1 });
    tx.orderItem.findUnique.mockResolvedValue({
      id: 'oi-1',
      status: 'pending',
      order_id: 'order-1',
      product_id: 'mi-1',
      quantity: 1,
    });
    tx.orderItem.update.mockResolvedValue({
      id: 'oi-1',
      status: 'preparing',
      ready_at: null,
    });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: unknown) => unknown) => cb(tx),
    );

    const result = await service.updateItemStatus('oi-1', 'preparing');

    expect(result.status).toBe('preparing');
    expect(result.ready_at).toBeNull();
    expect(mockFulfilment.deductItemIngredients).not.toHaveBeenCalled();
  });

  it('rejects a status the KDS board cannot set', async () => {
    // 'packed' is a valid OrderItemStatus (P5 shipping) but not a KDS transition
    await expect(service.updateItemStatus('oi-1', 'packed')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------
  // updateItemStatus — ready transitions with deduction
  // ---------------------------------------------------------------
  it('ready: deducts via FulfilmentService with the order actor and zone, Serializable', async () => {
    const tx = makeTx({ notReadyCount: 1 });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: unknown) => unknown) => cb(tx),
    );

    const result = await service.updateItemStatus('oi-1', 'ready');

    expect(result.status).toBe('ready');
    expect(mockFulfilment.deductItemIngredients).toHaveBeenCalledWith(
      tx,
      { id: 'oi-1', order_id: 'order-1', product_id: 'mi-1', quantity: 2 },
      { actor_type: 'user', actor_id: 'user-1' },
      'zone-1',
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 15000,
      }),
    );
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(mockEmitter.emit).not.toHaveBeenCalled();
  });

  it('ready: auto-transitions the order and emits order.ready when all items are ready', async () => {
    const tx = makeTx({ notReadyCount: 0 });
    let txResolved = false;
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: unknown) => unknown) => {
        const out = await cb(tx);
        txResolved = true;
        return out;
      },
    );
    mockEmitter.emit.mockImplementation(() => {
      // The event must never be dispatched from inside the transaction.
      expect(txResolved).toBe(true);
      return true;
    });

    await service.updateItemStatus('oi-1', 'ready');

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'ready' },
    });
    expect(mockEmitter.emit).toHaveBeenCalledTimes(1);
    expect(mockEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.ORDER_READY,
      expect.objectContaining({
        node_id: 'node-1',
        actor: { actor_type: 'user', actor_id: 'user-1' },
        occurred_at: expect.any(String),
        orderId: 'order-1',
        channel: 'dine_in',
        createdBy: 'user-1',
      }),
    );
  });

  it('ready: a throwing listener does not fail the status change', async () => {
    const tx = makeTx({ notReadyCount: 0 });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: unknown) => unknown) => cb(tx),
    );
    mockEmitter.emit.mockImplementation(() => {
      throw new Error('listener exploded');
    });

    await expect(
      service.updateItemStatus('oi-1', 'ready'),
    ).resolves.toMatchObject({ id: 'oi-1', status: 'ready' });
  });

  it('ready: propagates deduction failure so the transaction rolls back', async () => {
    const tx = makeTx({ notReadyCount: 0 });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: unknown) => unknown) => cb(tx),
    );
    mockFulfilment.deductItemIngredients.mockRejectedValue(
      new BadRequestException('Insufficient stock for Flour'),
    );

    await expect(service.updateItemStatus('oi-1', 'ready')).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.orderItem.update).not.toHaveBeenCalled();
  });

  it('ready: rejects orders without a zone', async () => {
    const tx = makeTx({ notReadyCount: 0, zone_id: null });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: unknown) => unknown) => cb(tx),
    );

    await expect(service.updateItemStatus('oi-1', 'ready')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockFulfilment.deductItemIngredients).not.toHaveBeenCalled();
  });
});
