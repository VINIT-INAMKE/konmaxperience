import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalsService } from '../approvals.service';
import { ApprovalPolicyService } from '../approval-policy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EvidenceService } from '../../evidence/evidence.service';
import { DelegationsService } from '../../delegations/delegations.service';
import { normaliseDecision } from '../dto/decide-approval.dto';
import {
  mockApprovalPolicyService,
  mockAuditService,
  mockEventEmitter,
  mockPrisma,
  provideAuditService,
  provideEventEmitter,
  type MockPrisma,
} from '../../test-utils/mock-providers';

const BACKEND_LEAD = 'BACKEND_LEAD';
const FOUNDER = 'FOUNDER_ADMIN';

describe('ApprovalsService', () => {
  let service: ApprovalsService;
  let prisma: MockPrisma;
  let evidenceService: {
    validateTask: jest.Mock;
    emitTaskValidated: jest.Mock;
  };
  let delegationsService: { getActiveDelegationForUser: jest.Mock };
  let policy: ReturnType<typeof mockApprovalPolicyService>;
  let audit: ReturnType<typeof mockAuditService>;
  let emitter: ReturnType<typeof mockEventEmitter>;

  const actor = { id: 'lead-1', roleCode: BACKEND_LEAD };
  const founder = { id: 'founder-1', roleCode: FOUNDER };

  const baseApproval = {
    id: 'approval-1',
    entity_type: 'evidence',
    entity_id: 'evidence-1',
    approval_scope: 'review',
    required_role_code: BACKEND_LEAD,
    approved_by: null,
    status: 'pending',
    notes: null,
    override_by: null,
    override_reason: null,
    override_at: null,
    delegated_from_user_id: null,
    policy_id: null,
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
  };

  const approvalOf = (overrides: Record<string, unknown> = {}) => ({
    ...baseApproval,
    ...overrides,
  });

  const validationResult = {
    valid: true,
    valid_xp: 100,
    newly_valid: true,
    user: { id: 'uploader-1', xp_total: 100, level: 1 },
    event: {
      taskId: 'task-1',
      nodeId: 'node-1',
      title: 'Ship the thing',
      ownerUserId: 'uploader-1',
      questId: 'quest-1',
      missionId: 'mission-1',
      readinessMeterId: null,
      validXp: 100,
    },
  };

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.evidence.findUnique.mockResolvedValue({ uploaded_by: 'uploader-1' });
    prisma.evidence.update.mockResolvedValue({ task_id: 'task-1' });
    prisma.task.findUnique.mockResolvedValue({ owner_user_id: 'uploader-1' });
    prisma.recipe.findUnique.mockResolvedValue({ created_by: 'chef-1' });
    prisma.decision.findUnique.mockResolvedValue({ proposed_by: 'proposer-1' });
    prisma.approval.findMany.mockResolvedValue([]);
    prisma.approval.count.mockResolvedValue(0);

    evidenceService = {
      validateTask: jest.fn().mockResolvedValue(validationResult),
      emitTaskValidated: jest.fn(),
    };
    delegationsService = {
      getActiveDelegationForUser: jest.fn().mockResolvedValue(null),
    };
    policy = mockApprovalPolicyService();
    audit = mockAuditService();
    emitter = mockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EvidenceService, useValue: evidenceService },
        { provide: DelegationsService, useValue: delegationsService },
        { provide: ApprovalPolicyService, useValue: policy },
        provideAuditService(audit),
        provideEventEmitter(emitter),
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
  });

  // ── decide ────────────────────────────────────────────────────────────────

  describe('decide', () => {
    it('approves with the matching required_role_code and records approval.decided', async () => {
      prisma.approval.findUnique.mockResolvedValue(approvalOf());

      await service.decide('approval-1', actor, { status: 'approved' });

      expect(prisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'approval-1' },
          data: expect.objectContaining({
            status: 'approved',
            approved_by: 'lead-1',
            delegated_from_user_id: null,
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entity_type: 'approval',
          entity_id: 'approval-1',
          action: 'approval.decided',
          actor_type: 'user',
          actor_id: 'lead-1',
        }),
      );
    });

    it('throws ForbiddenException naming the required role on a role mismatch', async () => {
      prisma.approval.findUnique.mockResolvedValue(
        approvalOf({ required_role_code: 'BI_LEAD' }),
      );

      await expect(
        service.decide('approval-1', actor, { status: 'approved' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.decide('approval-1', actor, { status: 'approved' }),
      ).rejects.toThrow('This approval is reserved for BI_LEAD');
    });

    it('lets FOUNDER_ADMIN bypass the role check', async () => {
      prisma.approval.findUnique.mockResolvedValue(
        approvalOf({ required_role_code: 'BI_LEAD' }),
      );

      await service.decide('approval-1', founder, { status: 'approved' });

      expect(prisma.approval.update).toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown approval', async () => {
      prisma.approval.findUnique.mockResolvedValue(null);

      await expect(
        service.decide('nope', actor, { status: 'approved' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the approval is already decided', async () => {
      prisma.approval.findUnique.mockResolvedValue(
        approvalOf({ status: 'approved' }),
      );

      await expect(
        service.decide('approval-1', actor, { status: 'approved' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.decide('approval-1', actor, { status: 'approved' }),
      ).rejects.toThrow('Approval approval-1 is already approved');
    });

    it('blocks self-approval', async () => {
      prisma.approval.findUnique.mockResolvedValue(approvalOf());
      prisma.evidence.findUnique.mockResolvedValue({ uploaded_by: 'lead-1' });

      await expect(
        service.decide('approval-1', actor, { status: 'approved' }),
      ).rejects.toThrow('You cannot approve your own work');
    });

    it('exempts the founder from the self-approval block', async () => {
      prisma.approval.findUnique.mockResolvedValue(
        approvalOf({ required_role_code: FOUNDER }),
      );
      prisma.evidence.findUnique.mockResolvedValue({
        uploaded_by: 'founder-1',
      });

      await service.decide('approval-1', founder, { status: 'approved' });

      expect(prisma.approval.update).toHaveBeenCalled();
    });

    it('lets a delegate decide and stores delegated_from_user_id', async () => {
      delegationsService.getActiveDelegationForUser.mockResolvedValue({
        id: 'delegation-1',
        from_user_id: 'user-a',
        to_user_id: 'user-b',
      });
      prisma.user.findUnique.mockResolvedValue({
        role: { code: BACKEND_LEAD },
      });
      prisma.approval.findUnique.mockResolvedValue(approvalOf());

      await service.decide(
        'approval-1',
        { id: 'user-b', roleCode: 'TALENT_LEAD' },
        { status: 'approved' },
      );

      expect(prisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            delegated_from_user_id: 'user-a',
          }),
        }),
      );
    });

    it('stores the note that came with a rejection', async () => {
      prisma.approval.findUnique.mockResolvedValue(approvalOf());

      await service.decide('approval-1', actor, {
        decision: 'reject',
        note: 'The photo does not show the finished plate',
      });

      expect(prisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rejected',
            notes: 'The photo does not show the finished plate',
          }),
        }),
      );
    });

    it('emits approval.decided after the transaction and survives a throwing emitter', async () => {
      prisma.approval.findUnique.mockResolvedValue(approvalOf());
      emitter.emit.mockImplementation(() => {
        throw new Error('listener exploded');
      });

      await expect(
        service.decide('approval-1', actor, { status: 'approved' }),
      ).resolves.toBeDefined();

      expect(emitter.emit).toHaveBeenCalledWith(
        'approval.decided',
        expect.objectContaining({
          approvalId: 'approval-1',
          entityType: 'evidence',
          entityId: 'evidence-1',
          status: 'approved',
          requiredRoleCode: BACKEND_LEAD,
          overridden: false,
        }),
      );
    });
  });

  // ── cascade ───────────────────────────────────────────────────────────────

  describe('cascade', () => {
    it('entity_type=evidence flips the evidence row and re-validates the task', async () => {
      prisma.approval.findUnique.mockResolvedValue(approvalOf());

      const result = await service.decide('approval-1', actor, {
        status: 'approved',
      });

      expect(prisma.evidence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evidence-1' },
          data: expect.objectContaining({
            approval_status: 'approved',
            reviewed_by: 'lead-1',
          }),
        }),
      );
      expect(evidenceService.validateTask).toHaveBeenCalledWith(
        'task-1',
        prisma,
      );
      expect(result).toEqual({
        valid: true,
        valid_xp: 100,
        newly_valid: true,
        user: { id: 'uploader-1', xp_total: 100, level: 1 },
      });
      expect(evidenceService.emitTaskValidated).toHaveBeenCalledWith(
        validationResult.event,
        'lead-1',
      );
    });

    it('entity_type=task re-validates the task itself', async () => {
      prisma.approval.findUnique.mockResolvedValue(
        approvalOf({ entity_type: 'task', entity_id: 'task-9' }),
      );

      await service.decide('approval-1', actor, { status: 'approved' });

      expect(evidenceService.validateTask).toHaveBeenCalledWith(
        'task-9',
        prisma,
      );
      expect(prisma.evidence.update).not.toHaveBeenCalled();
    });

    it('entity_type=recipe leaves the recipe pending while the policy is unsatisfied', async () => {
      prisma.approval.findUnique.mockResolvedValue(
        approvalOf({ entity_type: 'recipe', entity_id: 'recipe-1' }),
      );
      policy.isSatisfied.mockResolvedValue(false);

      const result = await service.decide('approval-1', actor, {
        status: 'approved',
      });

      expect(result).toEqual({ recipe_status: 'pending' });
      expect(prisma.recipe.update).not.toHaveBeenCalled();
    });

    it('entity_type=recipe flips to approved on the satisfying approval and records recipe.approved', async () => {
      prisma.approval.findUnique.mockResolvedValue(
        approvalOf({ entity_type: 'recipe', entity_id: 'recipe-1' }),
      );
      policy.isSatisfied.mockResolvedValue(true);
      prisma.recipe.update.mockResolvedValue({
        id: 'recipe-1',
        node_id: 'node-1',
        name: 'Masala Chai',
        version: 2,
        computed_cost: null,
      });

      const result = await service.decide('approval-1', actor, {
        status: 'approved',
      });

      expect(prisma.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'recipe-1' },
          data: { status: 'approved' },
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'recipe.approved' }),
      );
      expect(result).toEqual({ recipe_status: 'approved' });
      expect(emitter.emit).toHaveBeenCalledWith(
        'recipe.approved',
        expect.objectContaining({ recipeId: 'recipe-1', version: 2 }),
      );
    });

    it('entity_type=recipe sends the recipe back to draft on a rejection', async () => {
      prisma.approval.findUnique.mockResolvedValue(
        approvalOf({ entity_type: 'recipe', entity_id: 'recipe-1' }),
      );

      const result = await service.decide('approval-1', actor, {
        decision: 'reject',
        note: 'Yield does not match the portion size',
      });

      expect(prisma.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'recipe-1' },
          data: { status: 'draft' },
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'recipe.status_changed' }),
      );
      expect(result).toEqual({ recipe_status: 'draft' });
    });

    it('entity_type=decision leaves tallying to DecisionsService', async () => {
      prisma.approval.findUnique.mockResolvedValue(
        approvalOf({ entity_type: 'decision', entity_id: 'decision-1' }),
      );

      const result = await service.decide('approval-1', actor, {
        status: 'approved',
      });

      expect(result).toEqual({ decision: 'decision-1' });
      expect(evidenceService.validateTask).not.toHaveBeenCalled();
    });
  });

  // ── overrideApproval ──────────────────────────────────────────────────────

  describe('overrideApproval', () => {
    it('sets the four override columns and runs the same cascade', async () => {
      prisma.approval.findFirst.mockResolvedValue(approvalOf());

      const result = await service.overrideApproval(
        'approval-1',
        'admin-1',
        'Urgent override reason',
      );

      expect(prisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'approval-1' },
          data: expect.objectContaining({
            status: 'approved',
            approved_by: 'admin-1',
            override_by: 'admin-1',
            override_reason: 'Urgent override reason',
            override_at: expect.any(Date),
          }),
        }),
      );
      expect(evidenceService.validateTask).toHaveBeenCalledWith(
        'task-1',
        prisma,
      );
      expect(result).toEqual(
        expect.objectContaining({ overridden: true, valid: true }),
      );
    });

    it('records an approval.overridden AuditEvent inside the transaction', async () => {
      prisma.approval.findFirst.mockResolvedValue(
        approvalOf({ entity_type: 'task', entity_id: 'task-1' }),
      );

      await service.overrideApproval(
        'approval-1',
        'admin-1',
        'Override reason text',
      );

      expect(audit.record).toHaveBeenCalledWith(prisma, {
        entity_type: 'approval',
        entity_id: 'approval-1',
        action: 'approval.overridden',
        actor_type: 'user',
        actor_id: 'admin-1',
        before: { status: 'pending' },
        after: { status: 'approved', override_reason: 'Override reason text' },
      });
    });

    it('throws NotFoundException when no pending approval exists', async () => {
      prisma.approval.findFirst.mockResolvedValue(null);

      await expect(
        service.overrideApproval('missing-1', 'admin-1', 'Override reason'),
      ).rejects.toThrow(NotFoundException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('emits approval.decided with overridden: true', async () => {
      prisma.approval.findFirst.mockResolvedValue(approvalOf());

      await service.overrideApproval(
        'approval-1',
        'admin-1',
        'Override reason text',
      );

      expect(emitter.emit).toHaveBeenCalledWith(
        'approval.decided',
        expect.objectContaining({ overridden: true, status: 'approved' }),
      );
    });
  });

  // ── inbox ─────────────────────────────────────────────────────────────────

  describe('findApprovals', () => {
    it('mine=1 narrows to the caller effective role codes', async () => {
      delegationsService.getActiveDelegationForUser.mockResolvedValue({
        id: 'delegation-1',
        from_user_id: 'user-a',
      });
      prisma.user.findUnique.mockResolvedValue({ role: { code: 'BI_LEAD' } });

      await service.findApprovals(actor, { mine: '1' });

      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending',
            required_role_code: { in: [BACKEND_LEAD, 'BI_LEAD'] },
          }),
        }),
      );
    });

    it('a founder sees everything even with mine=1', async () => {
      await service.findApprovals(founder, { mine: '1' });

      const where = prisma.approval.findMany.mock.calls[0][0].where;
      expect(where.required_role_code).toBeUndefined();
      expect(
        delegationsService.getActiveDelegationForUser,
      ).not.toHaveBeenCalled();
    });

    it('honours entity_type, status, cursor and the 200-row cap', async () => {
      await service.findApprovals(actor, {
        entity_type: 'recipe',
        status: 'approved',
        cursor: '2026-08-01T00:00:00.000Z',
        limit: '5000',
      });

      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entity_type: 'recipe',
            status: 'approved',
            created_at: { lt: new Date('2026-08-01T00:00:00.000Z') },
          }),
          take: 200,
        }),
      );
    });

    it('attaches a subject per entity type and keeps the legacy task field', async () => {
      prisma.approval.findMany.mockResolvedValue([
        approvalOf({ id: 'a-task', entity_type: 'task', entity_id: 'task-1' }),
        approvalOf({
          id: 'a-recipe',
          entity_type: 'recipe',
          entity_id: 'recipe-1',
        }),
      ]);
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Ship the thing',
          status: 'done',
          owner: { id: 'uploader-1', name: 'Owner' },
          _count: { evidence: 2 },
        },
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        {
          id: 'recipe-1',
          name: 'Masala Chai',
          status: 'pending',
          version: 2,
          creator: { id: 'chef-1', name: 'Chef' },
        },
      ]);

      const rows = await service.findApprovals(actor, {});

      expect(rows[0].subject).toEqual({
        id: 'task-1',
        title: 'Ship the thing',
        url: '/tasks/task-1',
        owner: { id: 'uploader-1', name: 'Owner' },
        status: 'done',
      });
      expect(rows[0].task).not.toBeNull();
      expect(rows[1].subject).toEqual({
        id: 'recipe-1',
        title: 'Masala Chai (v2)',
        url: '/operations/recipes/recipe-1',
        owner: { id: 'chef-1', name: 'Chef' },
        status: 'pending',
      });
      expect(rows[1].task).toBeNull();
    });
  });

  describe('countForUser', () => {
    it('returns { count } narrowed to the caller role', async () => {
      prisma.approval.count.mockResolvedValue(3);

      const result = await service.countForUser(actor);

      expect(prisma.approval.count).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          required_role_code: { in: [BACKEND_LEAD] },
        },
      });
      expect(result).toEqual({ count: 3 });
    });

    it('counts every pending approval for the founder', async () => {
      prisma.approval.count.mockResolvedValue(9);

      const result = await service.countForUser(founder);

      expect(prisma.approval.count).toHaveBeenCalledWith({
        where: { status: 'pending' },
      });
      expect(result).toEqual({ count: 9 });
    });
  });

  // ── approveWithDelegation (v1 route shim) ─────────────────────────────────

  describe('approveWithDelegation', () => {
    it('delegates to decide with status approved', async () => {
      prisma.approval.findUnique.mockResolvedValue(approvalOf());

      await service.approveWithDelegation('approval-1', 'lead-1', BACKEND_LEAD);

      expect(prisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'approved' }),
        }),
      );
    });
  });

  // ── the controller-level reject guard ─────────────────────────────────────

  describe('normaliseDecision', () => {
    it('rejects a rejection with no note', () => {
      expect(() => normaliseDecision({ decision: 'reject' })).toThrow(
        'A note is required when rejecting',
      );
    });

    it('accepts the frontend { decision, note } spelling', () => {
      expect(
        normaliseDecision({ decision: 'reject', note: ' looks off ' }),
      ).toEqual({ status: 'rejected', notes: 'looks off' });
      expect(normaliseDecision({ decision: 'approve' })).toEqual({
        status: 'approved',
        notes: undefined,
      });
    });

    it('requires a decision', () => {
      expect(() => normaliseDecision({})).toThrow(BadRequestException);
      expect(() => normaliseDecision({ status: 'pending' })).toThrow(
        '`pending` is not a decision',
      );
    });
  });
});
