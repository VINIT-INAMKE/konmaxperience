import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  mockAuditService,
  mockEventEmitter,
  provideAuditService,
  provideEventEmitter,
} from '../test-utils/mock-providers';
import { DomainEvent } from '../common/events/domain-events';

jest.mock('../common/utils/unit-conversion', () => ({
  convertUnit: jest.fn(),
}));
import { convertUnit } from '../common/utils/unit-conversion';
const mockConvertUnit = convertUnit as jest.MockedFunction<typeof convertUnit>;

const makeTx = () => ({
  purchaseOrder: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
  purchaseOrderLine: { update: jest.fn(), findMany: jest.fn() },
  ingredientStock: { upsert: jest.fn() },
  stockMovement: { create: jest.fn() },
  auditEvent: { create: jest.fn() },
});

type MockPo = {
  purchaseOrder: { findUnique: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('PurchaseOrdersService — audit', () => {
  let service: PurchaseOrdersService;
  let prisma: MockPo;
  let tx: ReturnType<typeof makeTx>;
  let audit: ReturnType<typeof mockAuditService>;
  let emitter: ReturnType<typeof mockEventEmitter>;

  const draftPo = {
    id: 'po-1',
    zone_id: 'zone-1',
    status: PurchaseOrderStatus.draft,
    lines: [],
  };

  beforeEach(async () => {
    tx = makeTx();
    prisma = {
      purchaseOrder: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    };
    audit = mockAuditService();
    emitter = mockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: prisma },
        provideAuditService(audit),
        provideEventEmitter(emitter),
      ],
    }).compile();

    service = module.get(PurchaseOrdersService);
    jest.clearAllMocks();
    emitter.emit.mockReturnValue(true);
    mockConvertUnit.mockResolvedValue(null);
  });

  describe('update', () => {
    it('records purchase_order.status_changed on draft -> ordered inside the tx', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(draftPo);
      tx.purchaseOrder.update.mockResolvedValue({
        ...draftPo,
        status: PurchaseOrderStatus.ordered,
      });

      await service.update(
        'po-1',
        { status: PurchaseOrderStatus.ordered },
        'user-1',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(tx, {
        entity_type: 'purchase_order',
        entity_id: 'po-1',
        action: 'purchase_order.status_changed',
        actor_type: 'user',
        actor_id: 'user-1',
        before: { status: PurchaseOrderStatus.draft },
        after: { status: PurchaseOrderStatus.ordered },
      });
    });

    it('does not audit a notes-only edit', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(draftPo);
      tx.purchaseOrder.update.mockResolvedValue(draftPo);

      await service.update('po-1', { notes: 'call the vendor' }, 'user-1');

      expect(audit.record).not.toHaveBeenCalled();
    });

    it('rejects a non-ordered status transition before opening a transaction', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(draftPo);

      await expect(
        service.update(
          'po-1',
          { status: PurchaseOrderStatus.cancelled },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('receivePurchaseOrder', () => {
    it('records purchase_order.received with the resulting status', async () => {
      tx.purchaseOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'po-1',
        zone_id: 'zone-1',
        status: PurchaseOrderStatus.ordered,
        lines: [
          {
            id: 'pol-1',
            ingredient_id: 'ing-1',
            quantity: 10,
            received_quantity: 0,
            unit: 'kg',
            ingredient: { id: 'ing-1', base_unit: 'g' },
          },
        ],
      });
      mockConvertUnit.mockResolvedValue(10000);
      tx.purchaseOrderLine.findMany.mockResolvedValue([
        { id: 'pol-1', quantity: 10, received_quantity: 10 },
      ]);
      tx.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.received,
      });

      await service.receivePurchaseOrder(
        'po-1',
        { lines: [{ id: 'pol-1', received_quantity: 10 }] },
        'user-1',
      );

      expect(audit.record).toHaveBeenCalledWith(tx, {
        entity_type: 'purchase_order',
        entity_id: 'po-1',
        action: 'purchase_order.received',
        actor_type: 'user',
        actor_id: 'user-1',
        before: { status: PurchaseOrderStatus.ordered },
        after: { status: PurchaseOrderStatus.received, lines: 1 },
      });
    });

    // -------------------------------------------------------------
    // purchase_order.received domain event (SPEC §4.1)
    // -------------------------------------------------------------
    describe('purchase_order.received', () => {
      const arrangeReceive = () => {
        tx.purchaseOrder.findUniqueOrThrow.mockResolvedValue({
          id: 'po-1',
          zone_id: 'zone-1',
          status: PurchaseOrderStatus.ordered,
          lines: [
            {
              id: 'pol-1',
              ingredient_id: 'ing-1',
              quantity: 10,
              received_quantity: 0,
              unit: 'kg',
              ingredient: { id: 'ing-1', base_unit: 'g' },
            },
          ],
        });
        mockConvertUnit.mockResolvedValue(10000);
        tx.purchaseOrderLine.findMany.mockResolvedValue([
          { id: 'pol-1', quantity: 10, received_quantity: 10 },
        ]);
      };

      it('emits once, after the transaction resolves, with the typed payload', async () => {
        arrangeReceive();
        let txResolved = false;
        prisma.$transaction.mockImplementation(
          async (cb: (t: unknown) => unknown) => {
            const out = await cb(tx);
            txResolved = true;
            return out;
          },
        );
        tx.purchaseOrder.update.mockResolvedValue({
          id: 'po-1',
          node_id: 'node-1',
          status: PurchaseOrderStatus.received,
          vendor_id: 'v-1',
          vendor: { id: 'v-1', name: 'Green Farms' },
          linked_task_id: 'task-9',
          total_amount: '4200.00',
        });
        emitter.emit.mockImplementation(() => {
          expect(txResolved).toBe(true);
          return true;
        });

        await service.receivePurchaseOrder(
          'po-1',
          { lines: [{ id: 'pol-1', received_quantity: 10 }] },
          'user-1',
        );

        expect(emitter.emit).toHaveBeenCalledTimes(1);
        expect(emitter.emit).toHaveBeenCalledWith(
          DomainEvent.PURCHASE_ORDER_RECEIVED,
          expect.objectContaining({
            node_id: 'node-1',
            actor: { actor_type: 'user', actor_id: 'user-1' },
            occurred_at: expect.any(String),
            purchaseOrderId: 'po-1',
            vendorId: 'v-1',
            vendorName: 'Green Farms',
            linkedTaskId: 'task-9',
            lineCount: 1,
            totalAmount: '4200.00',
            fullyReceived: true,
          }),
        );
      });

      it('still resolves when the emitter throws', async () => {
        arrangeReceive();
        const updated = {
          id: 'po-1',
          node_id: 'node-1',
          status: PurchaseOrderStatus.received,
          vendor_id: 'v-1',
          vendor: { id: 'v-1', name: 'Green Farms' },
          linked_task_id: null,
          total_amount: '4200.00',
        };
        tx.purchaseOrder.update.mockResolvedValue(updated);
        emitter.emit.mockImplementation(() => {
          throw new Error('listener exploded');
        });

        await expect(
          service.receivePurchaseOrder(
            'po-1',
            { lines: [{ id: 'pol-1', received_quantity: 10 }] },
            'user-1',
          ),
        ).resolves.toEqual(updated);
      });
    });
  });

  describe('cancel', () => {
    it('records purchase_order.cancelled inside the tx', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        ...draftPo,
        status: PurchaseOrderStatus.ordered,
      });
      tx.purchaseOrder.update.mockResolvedValue({
        ...draftPo,
        status: PurchaseOrderStatus.cancelled,
      });

      await service.cancel('po-1', 'user-1');

      expect(audit.record).toHaveBeenCalledWith(tx, {
        entity_type: 'purchase_order',
        entity_id: 'po-1',
        action: 'purchase_order.cancelled',
        actor_type: 'user',
        actor_id: 'user-1',
        before: { status: PurchaseOrderStatus.ordered },
        after: { status: PurchaseOrderStatus.cancelled },
      });
    });

    it('refuses to cancel an already received PO and writes no audit row', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        ...draftPo,
        status: PurchaseOrderStatus.received,
      });

      await expect(service.cancel('po-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
