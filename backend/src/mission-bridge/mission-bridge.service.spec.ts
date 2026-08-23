import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import {
  ActorType,
  BridgeOutcome,
  Prisma,
  TaskSubjectType,
} from '@prisma/client';
import { MissionBridgeService } from './mission-bridge.service';
import { MissionBridgeListener } from './mission-bridge.listener';
import { P3_RULES, RULES_BY_EVENT } from './mission-bridge.rules';
import type { BridgeRule } from './mission-bridge.rules';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalPolicyService } from '../approvals/approval-policy.service';
import { AuditService } from '../audit/audit.service';
import { ReadinessDerivationService } from '../readiness/readiness-derivation.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { SYSTEM_USER_ID } from '../common/constants/system-actor';
import { RoleCode } from '../types/roles';
import {
  DomainEvent,
  domainEventBase,
  systemActor,
  type DomainEventPayloads,
} from '../common/events/domain-events';
import type { Tx } from '../common/types/transaction';
import {
  mockApprovalPolicyService,
  mockAuditService,
  mockPrisma,
  type MockPrisma,
} from '../test-utils/mock-providers';

const base = () => domainEventBase(DEFAULT_NODE_ID, systemActor());

const recipeApproved = (): DomainEventPayloads['recipe.approved'] => ({
  ...base(),
  recipeId: 'rec-1',
  name: 'Masala Chai',
  version: 2,
  computedCost: '42.50',
});

const feedbackReceived = (
  over: Partial<DomainEventPayloads['feedback.received']> = {},
): DomainEventPayloads['feedback.received'] => ({
  ...base(),
  feedbackId: 'fb-1',
  orderId: 'ord-1',
  rating: 2,
  comment: 'Cold and late.',
  ...over,
});

const stockLow = (): DomainEventPayloads['stock.low'] => ({
  ...base(),
  ingredientId: 'ing-1',
  ingredientName: 'Cardamom',
  currentQty: 2,
  minQty: 10,
  unit: 'kg',
  zoneId: 'zone-1',
});

const ruleFor = (key: string): BridgeRule => {
  const rule = P3_RULES.find((r) => r.key === key);
  if (!rule) throw new Error(`no rule ${key}`);
  return rule;
};

/** The only method the bridge calls; wired with an explicit token below. */
const mockDerivation = () => ({
  recomputeWithHybrids: jest.fn().mockResolvedValue(undefined),
});

describe('MissionBridgeService', () => {
  let service: MissionBridgeService;
  let prisma: MockPrisma;
  let derivation: ReturnType<typeof mockDerivation>;
  let approvalPolicy: ReturnType<typeof mockApprovalPolicyService>;
  let audit: ReturnType<typeof mockAuditService>;

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.bridgeDispatch.create.mockResolvedValue({ id: 'disp-1' });
    prisma.bridgeDispatch.update.mockResolvedValue({ id: 'disp-1' });
    prisma.evidence.create.mockResolvedValue({ id: 'ev-1' });
    prisma.readinessSignal.create.mockResolvedValue({ id: 'sig-1' });
    derivation = mockDerivation();
    approvalPolicy = mockApprovalPolicyService();
    audit = mockAuditService();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MissionBridgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReadinessDerivationService, useValue: derivation },
        { provide: ApprovalPolicyService, useValue: approvalPolicy },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(MissionBridgeService);
  });

  /** A node whose four derived meters are seeded. */
  const seedMeter = (id = 'meter-1') =>
    prisma.readinessMeter.findUnique.mockResolvedValue({ id });

  /** An active mission plus an active FRONTEND_LEAD — what the spawn needs. */
  const seedSpawnPrerequisites = () => {
    prisma.mission.findFirst.mockResolvedValue({ id: 'mis-1' });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-fe' });
    prisma.task.create.mockResolvedValue({
      id: 'task-spawned',
      domain: 'food',
    });
  };

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

  // ─── Signals and derived recompute (BRIDGE-02) ─────────────────────────────

  describe('signals', () => {
    it('writes a ReadinessSignal for the rule meter inside the dispatch', async () => {
      seedMeter('meter-std');
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });

      await service.apply(DomainEvent.RECIPE_APPROVED, recipeApproved());

      expect(prisma.readinessMeter.findUnique).toHaveBeenCalledWith({
        where: {
          node_id_code: { node_id: DEFAULT_NODE_ID, code: 'STANDARDIZATION' },
        },
        select: { id: true },
      });
      expect(prisma.readinessSignal.create).toHaveBeenCalledWith({
        data: {
          node_id: DEFAULT_NODE_ID,
          meter_id: 'meter-std',
          source_event: DomainEvent.RECIPE_APPROVED,
          source_type: TaskSubjectType.recipe,
          source_id: 'rec-1',
          value: new Prisma.Decimal(1),
        },
      });
    });

    it('records a negative contribution verbatim', async () => {
      seedMeter('meter-proc');

      await service.apply(DomainEvent.STOCK_LOW, stockLow());

      const arg = prisma.readinessSignal.create.mock.calls[0][0] as {
        data: { value: Prisma.Decimal };
      };
      expect(arg.data.value.toString()).toBe('-1');
    });

    it('writes nothing and does not throw when the meter is not seeded', async () => {
      prisma.readinessMeter.findUnique.mockResolvedValue(null);
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });

      await expect(
        service.apply(DomainEvent.RECIPE_APPROVED, recipeApproved()),
      ).resolves.toBeUndefined();

      expect(prisma.readinessSignal.create).not.toHaveBeenCalled();
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: BridgeOutcome.applied }),
        }),
      );
    });

    it('writes the signal even when the subject resolves to no task', async () => {
      seedMeter('meter-std');
      prisma.task.findFirst.mockResolvedValue(null);

      await service.apply(DomainEvent.RECIPE_APPROVED, recipeApproved());

      expect(prisma.readinessSignal.create).toHaveBeenCalledTimes(1);
      expect(prisma.evidence.create).not.toHaveBeenCalled();
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            outcome: BridgeOutcome.skipped_no_task,
          }),
        }),
      );
    });

    it('writes a signal and no evidence for an evidence-less rule', async () => {
      seedMeter('meter-sales');

      await service.apply(DomainEvent.ORDER_SERVED, {
        ...base(),
        orderId: 'ord-1',
        orderNumber: 7,
        channel: 'dine_in',
        total: '450.00',
      });

      expect(prisma.evidence.create).not.toHaveBeenCalled();
      expect(prisma.readinessSignal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meter_id: 'meter-sales',
            source_event: DomainEvent.ORDER_SERVED,
            source_type: TaskSubjectType.order,
            source_id: 'ord-1',
          }),
        }),
      );
      expect(derivation.recomputeWithHybrids).toHaveBeenCalledWith('SALES');
    });

    it('recomputes the meter and its hybrids once, after the dispatch resolves', async () => {
      seedMeter('meter-std');
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      const order: string[] = [];
      prisma.bridgeDispatch.update.mockImplementation(() => {
        order.push('ledger');
        return Promise.resolve({ id: 'disp-1' });
      });
      derivation.recomputeWithHybrids.mockImplementation(() => {
        order.push('recompute');
        return Promise.resolve(undefined);
      });

      await service.apply(DomainEvent.RECIPE_APPROVED, recipeApproved());

      expect(order).toEqual(['ledger', 'recompute']);
      expect(derivation.recomputeWithHybrids).toHaveBeenCalledTimes(1);
      expect(derivation.recomputeWithHybrids).toHaveBeenCalledWith(
        'STANDARDIZATION',
      );
    });

    it('does not recompute when the dispatch was a replay', async () => {
      seedMeter('meter-std');
      prisma.bridgeDispatch.create.mockRejectedValue({ code: 'P2002' });

      await service.apply(DomainEvent.RECIPE_APPROVED, recipeApproved());

      expect(derivation.recomputeWithHybrids).not.toHaveBeenCalled();
    });

    it('swallows a failing recompute so the caller is never affected', async () => {
      seedMeter('meter-std');
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      derivation.recomputeWithHybrids.mockRejectedValue(
        new Error('formula exploded'),
      );

      await expect(
        service.apply(DomainEvent.RECIPE_APPROVED, recipeApproved()),
      ).resolves.toBeUndefined();
      expect(derivation.recomputeWithHybrids).toHaveBeenCalled();
    });

    it('skips the signal half entirely for a rule that declares none', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-dec' });

      await service.apply(DomainEvent.DECISION_RESOLVED, {
        ...base(),
        decisionId: 'dec-1',
        title: 'Switch dairy vendor',
        tier: 'tier_2',
        status: 'approved',
        linkedTaskId: null,
      });

      expect(prisma.readinessMeter.findUnique).not.toHaveBeenCalled();
      expect(prisma.readinessSignal.create).not.toHaveBeenCalled();
      expect(derivation.recomputeWithHybrids).not.toHaveBeenCalled();
    });
  });

  // ─── Improvement-task spawn (BRIDGE-04) ────────────────────────────────────

  describe('low-rating improvement spawn', () => {
    it('creates one improvement task owned by the active FRONTEND_LEAD', async () => {
      seedMeter('meter-quality');
      prisma.task.findFirst.mockResolvedValue(null);
      seedSpawnPrerequisites();

      await service.apply(DomainEvent.FEEDBACK_RECEIVED, feedbackReceived());

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { status: 'active', role: { code: RoleCode.FRONTEND_LEAD } },
        select: { id: true },
      });
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          node_id: DEFAULT_NODE_ID,
          mission_id: 'mis-1',
          title: 'Follow up on 2-star feedback',
          description:
            'A guest rated order ord-1 2/5. They said: "Cold and late." ' +
            'Find the cause, fix it, and attach the evidence.',
          task_type: 'improvement',
          domain: 'food',
          owner_user_id: 'user-fe',
          created_by: SYSTEM_USER_ID,
          priority: 'medium',
          subject_type: TaskSubjectType.order,
          subject_id: 'ord-1',
          requires_approval: true,
        },
        select: { id: true, domain: true },
      });
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            outcome: BridgeOutcome.applied,
            task_id: 'task-spawned',
          }),
        }),
      );
    });

    it('materialises the spawned task approvals and audits the spawn', async () => {
      seedMeter('meter-quality');
      seedSpawnPrerequisites();

      await service.apply(DomainEvent.FEEDBACK_RECEIVED, feedbackReceived());

      expect(approvalPolicy.materialise).toHaveBeenCalledWith(
        prisma,
        {
          entity_type: 'task',
          entity_id: 'task-spawned',
          scope: 'task',
          domain: 'food',
        },
        DEFAULT_NODE_ID,
      );
      expect(audit.record).toHaveBeenCalledWith(prisma, {
        node_id: DEFAULT_NODE_ID,
        entity_type: 'task',
        entity_id: 'task-spawned',
        action: 'task.spawned_by_bridge',
        actor_type: ActorType.system,
        actor_id: null,
        after: {
          rule: 'low_rating_improvement',
          rating: 2,
          order_id: 'ord-1',
        },
      });
    });

    it('raises the priority to high at one star', async () => {
      seedMeter('meter-quality');
      seedSpawnPrerequisites();

      await service.apply(
        DomainEvent.FEEDBACK_RECEIVED,
        feedbackReceived({ rating: 1, comment: null }),
      );

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 'high',
            title: 'Follow up on 1-star feedback',
            description:
              'A guest rated order ord-1 1/5. ' +
              'Find the cause, fix it, and attach the evidence.',
          }),
        }),
      );
    });

    it('spawns nothing above the threshold but still applies the rule', async () => {
      seedMeter('meter-quality');
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      seedSpawnPrerequisites();

      await service.apply(
        DomainEvent.FEEDBACK_RECEIVED,
        feedbackReceived({ rating: 5 }),
      );

      expect(prisma.task.create).not.toHaveBeenCalled();
      expect(prisma.mission.findFirst).not.toHaveBeenCalled();
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith({
        where: { id: 'disp-1' },
        data: {
          outcome: BridgeOutcome.applied,
          task_id: 'task-1',
          evidence_id: 'ev-1',
          detail: 'rating above threshold, no task spawned',
        },
      });
    });

    it('records skipped_no_mission and creates no task without an active mission', async () => {
      seedMeter('meter-quality');
      prisma.mission.findFirst.mockResolvedValue(null);

      await service.apply(DomainEvent.FEEDBACK_RECEIVED, feedbackReceived());

      expect(prisma.task.create).not.toHaveBeenCalled();
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            outcome: BridgeOutcome.skipped_no_mission,
            detail: 'no active mission',
          }),
        }),
      );
    });

    it('records skipped_no_owner when no active FRONTEND_LEAD exists', async () => {
      seedMeter('meter-quality');
      prisma.mission.findFirst.mockResolvedValue({ id: 'mis-1' });
      prisma.user.findFirst.mockResolvedValue(null);

      await service.apply(DomainEvent.FEEDBACK_RECEIVED, feedbackReceived());

      expect(prisma.task.create).not.toHaveBeenCalled();
      expect(prisma.bridgeDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            outcome: BridgeOutcome.skipped_no_owner,
            detail: 'no active FRONTEND_LEAD',
          }),
        }),
      );
    });

    it('is a no-op the second time the same order is reported', async () => {
      seedMeter('meter-quality');
      seedSpawnPrerequisites();
      prisma.bridgeDispatch.create
        .mockResolvedValueOnce({ id: 'disp-1' })
        .mockRejectedValueOnce({ code: 'P2002' });

      await service.apply(DomainEvent.FEEDBACK_RECEIVED, feedbackReceived());
      await service.apply(
        DomainEvent.FEEDBACK_RECEIVED,
        feedbackReceived({ feedbackId: 'fb-2', rating: 1 }),
      );

      expect(prisma.task.create).toHaveBeenCalledTimes(1);
      expect(prisma.readinessSignal.create).toHaveBeenCalledTimes(1);
    });

    it('falls back to the feedback id as the subject when the order is unknown', async () => {
      seedMeter('meter-quality');
      seedSpawnPrerequisites();

      await service.apply(
        DomainEvent.FEEDBACK_RECEIVED,
        feedbackReceived({ orderId: null }),
      );

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subject_id: 'fb-1',
            description:
              'A guest rated order (unknown) 2/5. They said: "Cold and late." ' +
              'Find the cause, fix it, and attach the evidence.',
          }),
        }),
      );
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
