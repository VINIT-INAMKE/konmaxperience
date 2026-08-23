import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { BridgeOutcome, TaskSubjectType } from '@prisma/client';
import { MissionBridgeService } from './mission-bridge.service';
import { MissionBridgeListener } from './mission-bridge.listener';
import { P3_RULES, RULES_BY_EVENT } from './mission-bridge.rules';
import type { BridgeRule } from './mission-bridge.rules';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { SYSTEM_USER_ID } from '../common/constants/system-actor';
import {
  DomainEvent,
  domainEventBase,
  systemActor,
  type DomainEventPayloads,
} from '../common/events/domain-events';
import type { Tx } from '../common/types/transaction';
import { mockPrisma, type MockPrisma } from '../test-utils/mock-providers';

const base = () => domainEventBase(DEFAULT_NODE_ID, systemActor());

const recipeApproved = (): DomainEventPayloads['recipe.approved'] => ({
  ...base(),
  recipeId: 'rec-1',
  name: 'Masala Chai',
  version: 2,
  computedCost: '42.50',
});

const ruleFor = (key: string): BridgeRule => {
  const rule = P3_RULES.find((r) => r.key === key);
  if (!rule) throw new Error(`no rule ${key}`);
  return rule;
};

describe('MissionBridgeService', () => {
  let service: MissionBridgeService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.bridgeDispatch.create.mockResolvedValue({ id: 'disp-1' });
    prisma.bridgeDispatch.update.mockResolvedValue({ id: 'disp-1' });
    prisma.evidence.create.mockResolvedValue({ id: 'ev-1' });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MissionBridgeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(MissionBridgeService);
  });

  // ─── resolveTaskId ─────────────────────────────────────────────────────────

  describe('resolveTaskId', () => {
    it('returns the explicit task link without querying', async () => {
      const taskId = await service.resolveTaskId(prisma as unknown as Tx, {
        subject_type: TaskSubjectType.purchase_order,
        subject_id: 'po-1',
        explicit_task_id: 'task-explicit',
      });

      expect(taskId).toBe('task-explicit');
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to the newest open task on subject_type/subject_id', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });

      const taskId = await service.resolveTaskId(prisma as unknown as Tx, {
        subject_type: TaskSubjectType.recipe,
        subject_id: 'rec-1',
      });

      expect(taskId).toBe('task-1');
      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: {
          subject_type: TaskSubjectType.recipe,
          subject_id: 'rec-1',
          valid: false,
        },
        orderBy: { created_at: 'desc' },
        select: { id: true },
      });
    });

    it('returns null when no open task matches the subject', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveTaskId(prisma as unknown as Tx, {
          subject_type: TaskSubjectType.recipe,
          subject_id: 'rec-nope',
        }),
      ).resolves.toBeNull();
    });
  });

  // ─── createBridgeEvidence ──────────────────────────────────────────────────

  describe('createBridgeEvidence', () => {
    it('writes system/bridge evidence with a deep link and rendered note', async () => {
      const rule = ruleFor('recipe_approved_v1');

      const id = await service.createBridgeEvidence(
        prisma as unknown as Tx,
        'task-1',
        rule,
        { subject_type: TaskSubjectType.recipe, subject_id: 'rec-1' },
        { name: 'Masala Chai', version: 2, cost: '42.50' },
      );

      expect(id).toBe('ev-1');
      expect(prisma.evidence.create).toHaveBeenCalledWith({
        data: {
          task_id: 'task-1',
          uploaded_by: SYSTEM_USER_ID,
          type: 'system',
          source: 'bridge',
          bridge_event: DomainEvent.RECIPE_APPROVED,
          url: '/operations/recipes/rec-1',
          notes: 'Recipe "Masala Chai" v2 approved (computed cost 42.50).',
        },
        select: { id: true },
      });
    });

    it('leaves approval_status to the schema default (pending)', async () => {
      await service.createBridgeEvidence(
        prisma as unknown as Tx,
        'task-1',
        ruleFor('recipe_approved_v1'),
        { subject_type: TaskSubjectType.recipe, subject_id: 'rec-1' },
        {},
      );

      const arg = prisma.evidence.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(arg.data).not.toHaveProperty('approval_status');
      expect(arg.data).not.toHaveProperty('reviewed_by');
    });
  });

  // ─── dispatchOnce ──────────────────────────────────────────────────────────

  describe('dispatchOnce', () => {
    const subject = {
      subject_type: TaskSubjectType.recipe,
      subject_id: 'rec-1',
    };

    it('claims the ledger row before running the work, then records the outcome', async () => {
      const order: string[] = [];
      prisma.bridgeDispatch.create.mockImplementation(() => {
        order.push('claim');
        return Promise.resolve({ id: 'disp-1' });
      });

      const result = await service.dispatchOnce(
        'recipe_approved_v1',
        DomainEvent.RECIPE_APPROVED,
        subject,
        DEFAULT_NODE_ID,
        () => {
          order.push('work');
          return Promise.resolve({
            outcome: BridgeOutcome.applied,
            task_id: 'task-1',
            evidence_id: 'ev-1',
          });
        },
      );

      expect(order).toEqual(['claim', 'work']);
      expect(result).toEqual({
        outcome: BridgeOutcome.applied,
        task_id: 'task-1',
        evidence_id: 'ev-1',
      });
      expect(prisma.bridgeDispatch.create).toHaveBeenCalledWith({
        data: {
          node_id: DEFAULT_NODE_ID,
          rule_key: 'recipe_approved_v1',
          event: DomainEvent.RECIPE_APPROVED,
          source_type: TaskSubjectType.recipe,
          source_id: 'rec-1',
          outcome: BridgeOutcome.applied,
        },
        select: { id: true },
      });
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith({
        where: { id: 'disp-1' },
        data: {
          outcome: BridgeOutcome.applied,
          task_id: 'task-1',
          evidence_id: 'ev-1',
          detail: null,
        },
      });
    });

    it('is a no-op on a replayed event (P2002 on the claim insert)', async () => {
      prisma.bridgeDispatch.create.mockRejectedValue({ code: 'P2002' });
      const work = jest.fn();

      await expect(
        service.dispatchOnce(
          'recipe_approved_v1',
          DomainEvent.RECIPE_APPROVED,
          subject,
          DEFAULT_NODE_ID,
          work,
        ),
      ).resolves.toBeNull();
      expect(work).not.toHaveBeenCalled();
      expect(prisma.bridgeDispatch.update).not.toHaveBeenCalled();
    });

    it('swallows any other failure so the caller is never affected', async () => {
      const work = jest.fn().mockRejectedValue(new Error('database on fire'));

      await expect(
        service.dispatchOnce(
          'recipe_approved_v1',
          DomainEvent.RECIPE_APPROVED,
          subject,
          DEFAULT_NODE_ID,
          work,
        ),
      ).resolves.toBeNull();
      expect(work).toHaveBeenCalled();
      expect(prisma.bridgeDispatch.update).not.toHaveBeenCalled();
    });
  });

  // ─── apply ─────────────────────────────────────────────────────────────────

  describe('apply', () => {
    it('creates one bridge evidence row when the subject resolves to a task', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });

      await service.apply(DomainEvent.RECIPE_APPROVED, recipeApproved());

      expect(prisma.evidence.create).toHaveBeenCalledTimes(1);
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith({
        where: { id: 'disp-1' },
        data: {
          outcome: BridgeOutcome.applied,
          task_id: 'task-1',
          evidence_id: 'ev-1',
          detail: null,
        },
      });
    });

    it('records skipped_no_task and writes no evidence when nothing resolves', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await service.apply(DomainEvent.RECIPE_APPROVED, recipeApproved());

      expect(prisma.evidence.create).not.toHaveBeenCalled();
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith({
        where: { id: 'disp-1' },
        data: {
          outcome: BridgeOutcome.skipped_no_task,
          task_id: null,
          evidence_id: null,
          detail: 'no open task for subject',
        },
      });
    });

    it('uses the explicit linked task without querying for one', async () => {
      await service.apply(DomainEvent.PURCHASE_ORDER_RECEIVED, {
        ...base(),
        purchaseOrderId: 'po-1',
        vendorId: 'v-1',
        vendorName: 'Acme',
        linkedTaskId: 'task-po',
        lineCount: 3,
        totalAmount: '1200.00',
        fullyReceived: true,
      });

      expect(prisma.task.findFirst).not.toHaveBeenCalled();
      expect(prisma.evidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            task_id: 'task-po',
            url: '/operations/purchase-orders/po-1',
            notes:
              'Purchase order received from Acme — 3 line(s), total 1200.00.',
          }),
        }),
      );
    });

    it('applies a signal-only rule without creating evidence', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await service.apply(DomainEvent.STOCK_LOW, {
        ...base(),
        ingredientId: 'ing-1',
        ingredientName: 'Cardamom',
        currentQty: 2,
        minQty: 10,
        unit: 'kg',
        zoneId: 'zone-1',
      });

      expect(prisma.evidence.create).not.toHaveBeenCalled();
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: BridgeOutcome.applied }),
        }),
      );
    });

    it('falls back to the default node when the payload carries no node_id', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });

      await service.apply(DomainEvent.RECIPE_APPROVED, {
        ...recipeApproved(),
        node_id: '',
      });

      expect(prisma.bridgeDispatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ node_id: DEFAULT_NODE_ID }),
        }),
      );
    });

    it('is a no-op for an event with no rule', async () => {
      await service.apply(DomainEvent.TASK_BLOCKED, {
        ...base(),
        taskId: 'task-1',
        taskTitle: 'Ship it',
        ownerUserId: 'user-1',
        blockedReason: null,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.bridgeDispatch.create).not.toHaveBeenCalled();
    });

    it('skips a rule whose payload carries no subject id', async () => {
      await service.apply(DomainEvent.FEEDBACK_RECEIVED, {
        ...base(),
        feedbackId: '',
        orderId: null,
        rating: 5,
        comment: null,
      });

      expect(prisma.bridgeDispatch.create).not.toHaveBeenCalled();
    });
  });

  // ─── listDispatches ────────────────────────────────────────────────────────

  describe('listDispatches', () => {
    it('returns the newest rows first and clamps the page size', async () => {
      prisma.bridgeDispatch.findMany.mockResolvedValue([]);

      await service.listDispatches(9999);

      expect(prisma.bridgeDispatch.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: 'desc' },
        take: 200,
      });
    });

    it('pages backwards from a cursor', async () => {
      prisma.bridgeDispatch.findMany.mockResolvedValue([]);
      const cursor = '2026-08-23T10:00:00.000Z';

      await service.listDispatches(10, cursor);

      expect(prisma.bridgeDispatch.findMany).toHaveBeenCalledWith({
        where: { created_at: { lt: new Date(cursor) } },
        orderBy: { created_at: 'desc' },
        take: 10,
      });
    });

    it('ignores an unparseable cursor rather than throwing', async () => {
      prisma.bridgeDispatch.findMany.mockResolvedValue([]);

      await service.listDispatches(10, 'not-a-date');

      expect(prisma.bridgeDispatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });
});

// ─── Listener wiring ─────────────────────────────────────────────────────────

describe('MissionBridgeListener', () => {
  it('subscribes to every event a P3 rule declares', async () => {
    const apply = jest.fn().mockResolvedValue(undefined);
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        MissionBridgeListener,
        { provide: MissionBridgeService, useValue: { apply } },
      ],
    }).compile();
    await moduleRef.init();
    const emitter = moduleRef.get(EventEmitter2);

    const events = [...new Set(P3_RULES.map((r) => r.event))];
    expect(events).toHaveLength(16);

    for (const event of events) {
      apply.mockClear();
      const payload = { probe: event };
      emitter.emit(event, payload);
      expect(apply).toHaveBeenCalledWith(event, payload);
    }

    await moduleRef.close();
  });

  it('indexes every rule by its event', () => {
    const indexed = [...RULES_BY_EVENT.values()].flat();
    expect(indexed).toHaveLength(P3_RULES.length + 5);
    for (const [event, rules] of RULES_BY_EVENT) {
      for (const rule of rules) expect(rule.event).toBe(event);
    }
  });

  it('keeps every rule key unique and versioned', () => {
    const keys = [...RULES_BY_EVENT.values()].flat().map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/_v\d+$/);
  });
});
