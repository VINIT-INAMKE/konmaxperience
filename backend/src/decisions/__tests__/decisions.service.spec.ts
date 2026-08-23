import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DecisionStatus, GovernanceTier, VoteValue } from '@prisma/client';
import {
  DecisionsService,
  tallyDecision,
  resolveRequiredRoles,
} from '../decisions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { RoleCode } from '../../types/roles';
import { UpdateDecisionDto } from '../dto/update-decision.dto';
import {
  mockPrisma,
  mockAuditService,
  mockEventEmitter,
  MockPrisma,
} from '../../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';

describe('DecisionsService', () => {
  let service: DecisionsService;
  let prisma: MockPrisma;
  let audit: ReturnType<typeof mockAuditService>;
  let emitter: ReturnType<typeof mockEventEmitter>;

  const mockDecision = {
    id: 'decision-1',
    node_id: NODE_ID,
    title: 'Adopt new supplier',
    decision_type: 'strategic',
    context: 'We need a reliable supplier for the new season',
    proposed_by: 'user-1',
    proposer: { id: 'user-1', name: 'Alice' },
    impact_scope: 'ops',
    final_decision: null,
    status: DecisionStatus.proposed,
    tier: GovernanceTier.tier_2,
    required_role_codes: [
      RoleCode.BACKEND_LEAD,
      RoleCode.FRONTEND_LEAD,
      RoleCode.BI_LEAD,
    ] as string[],
    resolved_by: null as string | null,
    resolved_at: null as Date | null,
    linked_task_id: null,
    linked_task: null,
    linked_mission_id: null,
    linked_mission: null,
    created_at: new Date(),
    updated_at: new Date(),
    votes: [] as unknown[],
  };

  const approvedDecision = {
    ...mockDecision,
    id: 'decision-2',
    status: DecisionStatus.approved,
  };

  const vote = (
    role_code: string,
    v: VoteValue,
    user_id = `u-${role_code}`,
  ) => ({
    id: `vote-${role_code}`,
    decision_id: 'decision-1',
    user_id,
    role_code,
    vote: v,
    notes: null,
    created_at: new Date(),
    user: { id: user_id, name: role_code },
  });

  /** Mirrors Prisma `create`/`update`: echo the written payload over a base row. */
  type WriteArgs = { data: Record<string, unknown> };
  const echo = (base: Record<string, unknown>) => (args: WriteArgs) =>
    Promise.resolve({ ...base, ...args.data });

  beforeEach(async () => {
    prisma = mockPrisma();
    audit = mockAuditService();
    emitter = mockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get<DecisionsService>(DecisionsService);
  });

  // ── Pure tally ────────────────────────────────────────────────────────────

  describe('tallyDecision', () => {
    const roles = [
      RoleCode.BACKEND_LEAD,
      RoleCode.FRONTEND_LEAD,
      RoleCode.BI_LEAD,
    ] as string[];

    it('ends the decision as rejected when any vote is a reject', () => {
      expect(
        tallyDecision(roles, [
          { role_code: RoleCode.BACKEND_LEAD, vote: VoteValue.approve },
          { role_code: RoleCode.FRONTEND_LEAD, vote: VoteValue.reject },
        ]),
      ).toEqual({ status: DecisionStatus.rejected, aligned: false });
    });

    it('approves and marks aligned when every required role approves', () => {
      expect(
        tallyDecision(
          roles,
          roles.map((r) => ({ role_code: r, vote: VoteValue.approve })),
        ),
      ).toEqual({ status: DecisionStatus.approved, aligned: true });
    });

    it('stays proposed when only two of three required roles approve', () => {
      expect(
        tallyDecision(roles, [
          { role_code: RoleCode.BACKEND_LEAD, vote: VoteValue.approve },
          { role_code: RoleCode.FRONTEND_LEAD, vote: VoteValue.approve },
        ]),
      ).toEqual({ status: DecisionStatus.proposed, aligned: false });
    });

    it('treats an abstain as not-approve', () => {
      expect(
        tallyDecision(roles, [
          { role_code: RoleCode.BACKEND_LEAD, vote: VoteValue.approve },
          { role_code: RoleCode.FRONTEND_LEAD, vote: VoteValue.approve },
          { role_code: RoleCode.BI_LEAD, vote: VoteValue.abstain },
        ]),
      ).toEqual({ status: DecisionStatus.proposed, aligned: false });
    });

    it('never auto-approves on silence (no required roles)', () => {
      expect(tallyDecision([], [])).toEqual({
        status: DecisionStatus.proposed,
        aligned: false,
      });
    });
  });

  describe('resolveRequiredRoles', () => {
    it('tier 1 resolves to the domain lead', () => {
      expect(resolveRequiredRoles(GovernanceTier.tier_1, 'food')).toEqual([
        RoleCode.BACKEND_LEAD,
      ]);
    });

    it('tier 3 forces the founder regardless of what was asked for', () => {
      expect(
        resolveRequiredRoles(GovernanceTier.tier_3, 'food', [RoleCode.BI_LEAD]),
      ).toEqual([RoleCode.FOUNDER_ADMIN]);
    });

    it('tier 2 de-duplicates the requested roles', () => {
      expect(
        resolveRequiredRoles(GovernanceTier.tier_2, 'food', [
          RoleCode.BACKEND_LEAD,
          RoleCode.BACKEND_LEAD,
          RoleCode.FRONTEND_LEAD,
          RoleCode.BI_LEAD,
        ]),
      ).toEqual([
        RoleCode.BACKEND_LEAD,
        RoleCode.FRONTEND_LEAD,
        RoleCode.BI_LEAD,
      ]);
    });
  });

  // ── findAll / findOne ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns decisions ordered by created_at desc, votes included', async () => {
      prisma.decision.findMany.mockResolvedValue([mockDecision]);

      const result = await service.findAll();

      expect(prisma.decision.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
          include: expect.objectContaining({
            votes: expect.objectContaining({
              include: { user: { select: { id: true, name: true } } },
            }),
          }),
        }),
      );
      expect(result).toEqual([mockDecision]);
    });

    it('filters by status when provided', async () => {
      prisma.decision.findMany.mockResolvedValue([mockDecision]);

      await service.findAll('proposed');

      expect(prisma.decision.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'proposed' } }),
      );
    });

    it('rejects a status that is not a DecisionStatus', async () => {
      await expect(service.findAll('deferred')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── create (tier rules) ───────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = {
      title: 'New decision',
      decision_type: 'individual',
      context: 'Some context here',
    };

    it('tier 1 proposed by the domain lead is approved on creation', async () => {
      prisma.decision.create.mockImplementation(echo(mockDecision));

      const result = await service.create(
        {
          ...baseDto,
          tier: GovernanceTier.tier_1,
          impact_scope: 'food',
        },
        { id: 'user-1', roleCode: RoleCode.BACKEND_LEAD },
      );

      expect(prisma.decision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DecisionStatus.approved,
            resolved_by: 'user-1',
            impact_scope: 'food',
            tier: GovernanceTier.tier_1,
            required_role_codes: [RoleCode.BACKEND_LEAD],
          }),
        }),
      );
      expect(result.status).toBe(DecisionStatus.approved);
      expect(result.resolved_at).toBeInstanceOf(Date);
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'decision.resolved' }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        'decision.resolved',
        expect.objectContaining({
          decisionId: result.id,
          status: DecisionStatus.approved,
          tier: GovernanceTier.tier_1,
        }),
      );
    });

    it('tier 1 proposed by anyone else stays proposed and waits for the lead', async () => {
      prisma.decision.create.mockImplementation(echo(mockDecision));

      const result = await service.create(
        {
          ...baseDto,
          tier: GovernanceTier.tier_1,
          impact_scope: 'food',
        },
        { id: 'user-9', roleCode: RoleCode.BI_LEAD },
      );

      expect(result.status).toBe(DecisionStatus.proposed);
      expect(result.required_role_codes).toEqual([RoleCode.BACKEND_LEAD]);
      expect(result.resolved_by).toBeNull();
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'decision.created' }),
      );
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('tier 2 with fewer than three roles is rejected', async () => {
      await expect(
        service.create(
          {
            ...baseDto,
            tier: GovernanceTier.tier_2,
            impact_scope: 'food',
            required_role_codes: [RoleCode.BACKEND_LEAD, RoleCode.BI_LEAD],
          },
          { id: 'user-1', roleCode: RoleCode.BACKEND_LEAD },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.decision.create).not.toHaveBeenCalled();
    });

    it('tier 3 forces required_role_codes to the founder', async () => {
      prisma.decision.create.mockImplementation(echo(mockDecision));

      const result = await service.create(
        {
          ...baseDto,
          tier: GovernanceTier.tier_3,
          impact_scope: 'tech',
        },
        { id: 'user-1', roleCode: RoleCode.TECH_LEAD },
      );

      expect(result.required_role_codes).toEqual([RoleCode.FOUNDER_ADMIN]);
      expect(result.status).toBe(DecisionStatus.proposed);
    });

    it('defaults to tier 1 / impact_scope ops when the v1 form omits them', async () => {
      prisma.decision.create.mockImplementation(echo(mockDecision));

      const result = await service.create(baseDto, {
        id: 'user-9',
        roleCode: RoleCode.BI_LEAD,
      });

      expect(result.impact_scope).toBe('ops');
      expect(result.tier).toBe(GovernanceTier.tier_1);
      expect(result.required_role_codes).toEqual([RoleCode.FOUNDER_ADMIN]);
      expect(result.status).toBe(DecisionStatus.proposed);
    });
  });

  // ── castVote ──────────────────────────────────────────────────────────────

  describe('castVote', () => {
    const voter = { id: 'user-be', roleCode: RoleCode.BACKEND_LEAD as string };

    it('upserts on (decision_id, user_id) and stores the role code', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      prisma.decisionVote.findMany.mockResolvedValue([
        vote(RoleCode.BACKEND_LEAD, VoteValue.approve, 'user-be'),
      ]);

      await service.castVote('decision-1', voter, {
        vote: VoteValue.approve,
        notes: 'Looks right',
      });

      expect(prisma.decisionVote.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            decision_id_user_id: {
              decision_id: 'decision-1',
              user_id: 'user-be',
            },
          },
          create: expect.objectContaining({
            role_code: RoleCode.BACKEND_LEAD,
            vote: VoteValue.approve,
            notes: 'Looks right',
          }),
          update: expect.objectContaining({
            role_code: RoleCode.BACKEND_LEAD,
            vote: VoteValue.approve,
          }),
        }),
      );
    });

    it('drops a reopened decision back to proposed without resolving it', async () => {
      prisma.decision.findUnique.mockResolvedValue({
        ...mockDecision,
        status: DecisionStatus.reopened,
      });
      prisma.decisionVote.findMany.mockResolvedValue([
        vote(RoleCode.BACKEND_LEAD, VoteValue.approve, 'user-be'),
      ]);
      prisma.decision.update.mockImplementation(echo(mockDecision));

      const result = await service.castVote('decision-1', voter, {
        vote: VoteValue.approve,
      });

      expect(prisma.decision.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: DecisionStatus.proposed,
            resolved_by: null,
            resolved_at: null,
          },
        }),
      );
      expect(result.decision.status).toBe(DecisionStatus.proposed);
      expect(emitter.emit).not.toHaveBeenCalled();
      const actions = audit.record.mock.calls.map(
        (c: unknown[]) => (c[1] as { action: string }).action,
      );
      expect(actions).toEqual(['decision.voted', 'decision.status_changed']);
    });

    it('does not move the decision or emit while the tally is incomplete', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      prisma.decisionVote.findMany.mockResolvedValue([
        vote(RoleCode.BACKEND_LEAD, VoteValue.approve, 'user-be'),
      ]);

      const result = await service.castVote('decision-1', voter, {
        vote: VoteValue.approve,
      });

      expect(prisma.decision.update).not.toHaveBeenCalled();
      expect(emitter.emit).not.toHaveBeenCalled();
      expect(result.votes).toHaveLength(1);
      expect(result.decision.status).toBe(DecisionStatus.proposed);
    });

    it('the aligning vote writes decision.aligned then decision.resolved and lands on approved', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      prisma.decisionVote.findMany.mockResolvedValue([
        vote(RoleCode.BACKEND_LEAD, VoteValue.approve, 'user-be'),
        vote(RoleCode.FRONTEND_LEAD, VoteValue.approve, 'user-fe'),
        vote(RoleCode.BI_LEAD, VoteValue.approve, 'user-bi'),
      ]);
      prisma.decision.update.mockImplementation(echo(mockDecision));

      const result = await service.castVote('decision-1', voter, {
        vote: VoteValue.approve,
      });

      const actions = audit.record.mock.calls.map(
        (c: unknown[]) => (c[1] as { action: string }).action,
      );
      expect(actions).toEqual([
        'decision.voted',
        'decision.aligned',
        'decision.resolved',
      ]);
      expect(prisma.decision.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DecisionStatus.approved,
            resolved_by: 'user-be',
          }),
        }),
      );
      expect(result.decision.status).toBe(DecisionStatus.approved);
      expect(emitter.emit).toHaveBeenCalledWith(
        'decision.resolved',
        expect.objectContaining({
          decisionId: 'decision-1',
          status: DecisionStatus.approved,
        }),
      );
    });

    it('any reject ends the decision without an aligned row', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      prisma.decisionVote.findMany.mockResolvedValue([
        vote(RoleCode.BACKEND_LEAD, VoteValue.reject, 'user-be'),
      ]);
      prisma.decision.update.mockImplementation(echo(mockDecision));

      const result = await service.castVote('decision-1', voter, {
        vote: VoteValue.reject,
      });

      const actions = audit.record.mock.calls.map(
        (c: unknown[]) => (c[1] as { action: string }).action,
      );
      expect(actions).toEqual(['decision.voted', 'decision.resolved']);
      expect(result.decision.status).toBe(DecisionStatus.rejected);
    });

    it('rejects a voter whose role is not on the decision', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);

      await expect(
        service.castVote(
          'decision-1',
          { id: 'user-x', roleCode: RoleCode.TALENT_LEAD },
          { vote: VoteValue.approve },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.decisionVote.upsert).not.toHaveBeenCalled();
    });

    it('exempts the founder from the required-role check', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      prisma.decisionVote.findMany.mockResolvedValue([
        vote(RoleCode.FOUNDER_ADMIN, VoteValue.approve, 'founder-1'),
      ]);

      await service.castVote(
        'decision-1',
        { id: 'founder-1', roleCode: RoleCode.FOUNDER_ADMIN },
        { vote: VoteValue.approve },
      );

      expect(prisma.decisionVote.upsert).toHaveBeenCalled();
    });

    it('refuses a vote on a decision that is already approved', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);

      await expect(
        service.castVote('decision-2', voter, { vote: VoteValue.approve }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── resolve / reopen ──────────────────────────────────────────────────────

  describe('resolve', () => {
    const founder = { id: 'founder-1', roleCode: RoleCode.FOUNDER_ADMIN };

    it('is founder-only', async () => {
      await expect(
        service.resolve(
          'decision-1',
          { id: 'user-1', roleCode: RoleCode.BACKEND_LEAD },
          { status: DecisionStatus.approved, final_decision: 'Ship it' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses a status that is not approved or rejected', async () => {
      await expect(
        service.resolve('decision-1', founder, {
          status: DecisionStatus.aligned,
          final_decision: 'Ship it',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('records the founder call, audits it and emits after commit', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      prisma.decision.update.mockImplementation(echo(mockDecision));

      const result = await service.resolve('decision-1', founder, {
        status: DecisionStatus.approved,
        final_decision: 'Ship it',
      });

      expect(prisma.decision.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DecisionStatus.approved,
            final_decision: 'Ship it',
            resolved_by: 'founder-1',
          }),
        }),
      );
      expect(result.status).toBe(DecisionStatus.approved);
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'decision.resolved' }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        'decision.resolved',
        expect.objectContaining({ decisionId: 'decision-1' }),
      );
    });

    it('refuses to resolve an already-resolved decision', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);

      await expect(
        service.resolve('decision-2', founder, {
          status: DecisionStatus.rejected,
          final_decision: 'Nope',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reopen', () => {
    const founder = { id: 'founder-1', roleCode: RoleCode.FOUNDER_ADMIN };

    it('is founder-only', async () => {
      await expect(
        service.reopen('decision-2', {
          id: 'user-1',
          roleCode: RoleCode.BACKEND_LEAD,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deletes the votes and clears the resolution', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);
      prisma.decision.update.mockImplementation(echo(approvedDecision));

      const result = await service.reopen('decision-2', founder);

      expect(prisma.decisionVote.deleteMany).toHaveBeenCalledWith({
        where: { decision_id: 'decision-2' },
      });
      expect(prisma.decision.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: DecisionStatus.reopened,
            resolved_by: null,
            resolved_at: null,
          },
        }),
      );
      expect(result.status).toBe(DecisionStatus.reopened);
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'decision.reopened' }),
      );
    });
  });

  // ── update / remove ───────────────────────────────────────────────────────

  describe('update', () => {
    it('throws ForbiddenException when updating approved decision as non-admin', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);

      await expect(
        service.update('decision-2', { title: 'Changed' }, 'user-1', false),
      ).rejects.toThrow(
        'Approved decisions are locked. Only admin can reopen.',
      );
    });

    it('succeeds when updating approved decision as admin', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);
      prisma.decision.update.mockResolvedValue({
        ...approvedDecision,
        title: 'Changed',
      });

      const result = await service.update(
        'decision-2',
        { title: 'Changed' },
        'admin-1',
        true,
      );

      expect(prisma.decision.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'decision-2' } }),
      );
      expect(result.title).toBe('Changed');
    });

    it('never moves the status — a stray status field is not written', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      prisma.decision.update.mockResolvedValue(mockDecision);

      await service.update(
        'decision-1',
        {
          title: 'Changed',
          status: DecisionStatus.approved,
        } as UpdateDecisionDto,
        'admin-1',
        true,
      );

      const [payload] = prisma.decision.update.mock.calls[0] as WriteArgs[];
      expect(payload.data).not.toHaveProperty('status');
      expect(payload.data).toEqual({ title: 'Changed' });
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when deleting an approved decision', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);

      await expect(service.remove('decision-2', false)).rejects.toThrow(
        'Cannot delete an approved decision',
      );
    });

    it('throws ForbiddenException even for admin when decision is approved', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);

      await expect(service.remove('decision-2', true)).rejects.toThrow(
        'Cannot delete an approved decision',
      );
    });

    it('allows deleting a proposed decision as non-admin', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      prisma.decision.delete.mockResolvedValue(mockDecision);

      const result = await service.remove('decision-1', false);

      expect(prisma.decision.delete).toHaveBeenCalledWith({
        where: { id: 'decision-1' },
      });
      expect(result).toEqual(mockDecision);
    });
  });
});
