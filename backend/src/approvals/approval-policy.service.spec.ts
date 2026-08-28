import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ApprovalEntityType,
  ApprovalMode,
  ApprovalScope,
  ApprovalStatus,
  TaskDomain,
} from '@prisma/client';
import {
  ApprovalPolicyService,
  DOMAIN_LEAD_ROLE,
} from './approval-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { RoleCode } from '../types/roles';
import type { Tx } from '../common/types/transaction';
import {
  mockPrisma,
  provideAuditService,
  PRISMA_METHODS,
  type MockModel,
  type MockPrisma,
} from '../test-utils/mock-providers';
import { BACKFILL_VALIDATION_PORT } from './backfill-validation.port';

/**
 * `approvalPolicy` is not in `PRISMA_MODELS` at this commit (Task 1 of P3 adds it),
 * so the model is supplied as a local override. `mockPrisma` merges unknown model
 * keys, so this keeps working unchanged once Task 1 lands.
 */
type PolicyPrisma = MockPrisma & { approvalPolicy: MockModel };

function makePrisma(): PolicyPrisma {
  return mockPrisma({
    approvalPolicy: Object.fromEntries(
      PRISMA_METHODS.map((m) => [m, jest.fn()]),
    ),
  }) as PolicyPrisma;
}

interface PolicyRow {
  id: string;
  node_id: string;
  scope: ApprovalScope;
  domain: TaskDomain | null;
  required_role_codes: string[];
  min_approvals: number;
  mode: ApprovalMode;
  is_default: boolean;
}

interface PolicyWhere {
  node_id?: string;
  scope?: ApprovalScope;
  domain?: TaskDomain | null;
  is_default?: boolean;
}

const policyRow = (over: Partial<PolicyRow> = {}): PolicyRow => ({
  id: 'policy-1',
  node_id: DEFAULT_NODE_ID,
  scope: ApprovalScope.task,
  domain: null,
  required_role_codes: [RoleCode.BACKEND_LEAD, RoleCode.FRONTEND_LEAD],
  min_approvals: 2,
  mode: ApprovalMode.all,
  is_default: false,
  ...over,
});

describe('ApprovalPolicyService', () => {
  let service: ApprovalPolicyService;
  let prisma: PolicyPrisma;

  /** Makes `approvalPolicy.findFirst` behave like the real query against `rows`. */
  function seedPolicies(rows: PolicyRow[]) {
    prisma.approvalPolicy.findFirst.mockImplementation(
      (args: { where: PolicyWhere }) => {
        const where = args.where;
        const match = rows.find((r) => {
          if (r.node_id !== where.node_id) return false;
          if (where.is_default !== undefined) {
            return r.is_default === where.is_default;
          }
          return r.scope === where.scope && r.domain === (where.domain ?? null);
        });
        return Promise.resolve(match ?? null);
      },
    );
  }

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalPolicyService,
        { provide: PrismaService, useValue: prisma },
        provideAuditService(),
        {
          provide: BACKFILL_VALIDATION_PORT,
          useValue: { validateTask: jest.fn() },
        },
      ],
    }).compile();
    service = module.get<ApprovalPolicyService>(ApprovalPolicyService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('DOMAIN_LEAD_ROLE', () => {
    it('covers every TaskDomain member', () => {
      for (const domain of Object.values(TaskDomain)) {
        expect(DOMAIN_LEAD_ROLE[domain]).toBeDefined();
      }
    });
  });

  describe('resolve', () => {
    it('returns the exact (scope, domain) row when one exists', async () => {
      const exact = policyRow({
        id: 'policy-exact',
        scope: ApprovalScope.recipe,
        domain: TaskDomain.food,
      });
      seedPolicies([exact]);

      const resolved = await service.resolve(
        ApprovalScope.recipe,
        TaskDomain.food,
      );

      expect(prisma.approvalPolicy.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.approvalPolicy.findFirst).toHaveBeenCalledWith({
        where: {
          node_id: DEFAULT_NODE_ID,
          scope: ApprovalScope.recipe,
          domain: TaskDomain.food,
        },
      });
      expect(resolved).toEqual({
        policy_id: 'policy-exact',
        scope: ApprovalScope.recipe,
        domain: TaskDomain.food,
        required_role_codes: [RoleCode.BACKEND_LEAD, RoleCode.FRONTEND_LEAD],
        min_approvals: 2,
        mode: ApprovalMode.all,
      });
    });

    it('falls back to the domain: null row for the same scope', async () => {
      seedPolicies([
        policyRow({
          id: 'policy-scope-fallback',
          scope: ApprovalScope.task,
          domain: null,
          required_role_codes: [RoleCode.FOUNDER_ADMIN],
          min_approvals: 1,
        }),
      ]);

      const resolved = await service.resolve(
        ApprovalScope.task,
        TaskDomain.tech,
      );

      expect(prisma.approvalPolicy.findFirst).toHaveBeenCalledTimes(2);
      expect(prisma.approvalPolicy.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          node_id: DEFAULT_NODE_ID,
          scope: ApprovalScope.task,
          domain: null,
        },
      });
      expect(resolved.policy_id).toBe('policy-scope-fallback');
      expect(resolved.required_role_codes).toEqual([RoleCode.FOUNDER_ADMIN]);
    });

    it('falls back to the is_default row when neither matches', async () => {
      seedPolicies([
        policyRow({
          id: 'policy-default',
          scope: ApprovalScope.task,
          domain: null,
          is_default: true,
          required_role_codes: [RoleCode.TECH_LEAD],
          min_approvals: 1,
          mode: ApprovalMode.n_of,
        }),
      ]);

      const resolved = await service.resolve(
        ApprovalScope.hiring,
        TaskDomain.talent,
      );

      expect(prisma.approvalPolicy.findFirst).toHaveBeenCalledTimes(3);
      expect(prisma.approvalPolicy.findFirst).toHaveBeenNthCalledWith(3, {
        where: { node_id: DEFAULT_NODE_ID, is_default: true },
      });
      expect(resolved.policy_id).toBe('policy-default');
      expect(resolved.mode).toBe(ApprovalMode.n_of);
    });

    it('substitutes the domain lead when the matched policy has no roles', async () => {
      seedPolicies([
        policyRow({
          id: 'policy-default',
          scope: ApprovalScope.task,
          domain: null,
          is_default: true,
          required_role_codes: [],
          min_approvals: 1,
          mode: ApprovalMode.n_of,
        }),
      ]);

      const resolved = await service.resolve(
        ApprovalScope.task,
        TaskDomain.procurement,
      );

      expect(resolved.required_role_codes).toEqual([RoleCode.PROCUREMENT_LEAD]);
      expect(resolved.min_approvals).toBe(1);
    });

    it('substitutes FOUNDER_ADMIN as the lead when the domain is null', async () => {
      seedPolicies([
        policyRow({
          id: 'policy-default',
          scope: ApprovalScope.task,
          domain: null,
          is_default: true,
          required_role_codes: [],
        }),
      ]);

      const resolved = await service.resolve(ApprovalScope.task, null);

      expect(resolved.required_role_codes).toEqual([RoleCode.FOUNDER_ADMIN]);
    });

    it('returns a synthetic single-approver policy when no rows exist at all', async () => {
      seedPolicies([]);

      const resolved = await service.resolve(
        ApprovalScope.task,
        TaskDomain.food,
      );

      expect(resolved).toEqual({
        policy_id: null,
        scope: ApprovalScope.task,
        domain: TaskDomain.food,
        required_role_codes: [RoleCode.BACKEND_LEAD],
        min_approvals: 1,
        mode: ApprovalMode.all,
      });
    });

    it('clamps min_approvals into [1, roles.length]', async () => {
      seedPolicies([
        policyRow({
          scope: ApprovalScope.pricing,
          domain: TaskDomain.bi,
          required_role_codes: [RoleCode.BI_LEAD, RoleCode.FRONTEND_LEAD],
          min_approvals: 9,
        }),
      ]);
      await expect(
        service.resolve(ApprovalScope.pricing, TaskDomain.bi),
      ).resolves.toMatchObject({ min_approvals: 2 });

      jest.clearAllMocks();
      seedPolicies([
        policyRow({
          scope: ApprovalScope.pricing,
          domain: TaskDomain.bi,
          required_role_codes: [RoleCode.BI_LEAD, RoleCode.FRONTEND_LEAD],
          min_approvals: 0,
        }),
      ]);
      await expect(
        service.resolve(ApprovalScope.pricing, TaskDomain.bi),
      ).resolves.toMatchObject({ min_approvals: 1 });
    });

    it('honours a non-default node id', async () => {
      seedPolicies([]);
      await service.resolve(ApprovalScope.task, TaskDomain.food, 'node-2');
      expect(prisma.approvalPolicy.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          node_id: 'node-2',
          scope: ApprovalScope.task,
          domain: TaskDomain.food,
        },
      });
    });
  });

  describe('materialise', () => {
    const input = {
      entity_type: ApprovalEntityType.task,
      entity_id: 'task-1',
      scope: ApprovalScope.task,
      domain: TaskDomain.food,
    };

    it('creates one pending row per missing role and returns the count', async () => {
      seedPolicies([
        policyRow({
          id: 'policy-food',
          scope: ApprovalScope.task,
          domain: TaskDomain.food,
        }),
      ]);
      prisma.approval.findMany.mockResolvedValue([]);
      prisma.approval.createMany.mockResolvedValue({ count: 2 });

      const created = await service.materialise(prisma as unknown as Tx, input);

      expect(created).toBe(2);
      expect(prisma.approval.createMany).toHaveBeenCalledWith({
        data: [
          {
            entity_type: ApprovalEntityType.task,
            entity_id: 'task-1',
            approval_scope: ApprovalScope.task,
            required_role_code: RoleCode.BACKEND_LEAD,
            policy_id: 'policy-food',
            status: ApprovalStatus.pending,
          },
          {
            entity_type: ApprovalEntityType.task,
            entity_id: 'task-1',
            approval_scope: ApprovalScope.task,
            required_role_code: RoleCode.FRONTEND_LEAD,
            policy_id: 'policy-food',
            status: ApprovalStatus.pending,
          },
        ],
      });
    });

    it('creates only the roles that are missing', async () => {
      seedPolicies([
        policyRow({
          id: 'policy-food',
          scope: ApprovalScope.task,
          domain: TaskDomain.food,
        }),
      ]);
      prisma.approval.findMany.mockResolvedValue([
        { required_role_code: RoleCode.BACKEND_LEAD },
      ]);
      prisma.approval.createMany.mockResolvedValue({ count: 1 });

      const created = await service.materialise(prisma as unknown as Tx, input);

      expect(created).toBe(1);
      expect(prisma.approval.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            required_role_code: RoleCode.FRONTEND_LEAD,
          }),
        ],
      });
    });

    it('creates nothing and returns 0 when every required role already has a row', async () => {
      seedPolicies([
        policyRow({
          id: 'policy-food',
          scope: ApprovalScope.task,
          domain: TaskDomain.food,
        }),
      ]);
      prisma.approval.findMany.mockResolvedValue([
        { required_role_code: RoleCode.BACKEND_LEAD },
        { required_role_code: RoleCode.FRONTEND_LEAD },
      ]);

      const created = await service.materialise(prisma as unknown as Tx, input);

      expect(created).toBe(0);
      expect(prisma.approval.createMany).not.toHaveBeenCalled();
    });
  });

  describe('isSatisfied', () => {
    const args = [
      ApprovalEntityType.task,
      'task-1',
      ApprovalScope.task,
      TaskDomain.food,
    ] as const;

    const call = () => service.isSatisfied(prisma as unknown as Tx, ...args);

    it('returns false when there are zero approval rows (decision 4)', async () => {
      seedPolicies([
        policyRow({ scope: ApprovalScope.task, domain: TaskDomain.food }),
      ]);
      prisma.approval.findMany.mockResolvedValue([]);

      await expect(call()).resolves.toBe(false);
      // Never even resolves a policy — zero rows is unconditionally unsatisfied.
      expect(prisma.approvalPolicy.findFirst).not.toHaveBeenCalled();
    });

    it('returns false when any row is rejected, even if min_approvals is met', async () => {
      seedPolicies([
        policyRow({
          scope: ApprovalScope.task,
          domain: TaskDomain.food,
          mode: ApprovalMode.n_of,
          min_approvals: 1,
        }),
      ]);
      prisma.approval.findMany.mockResolvedValue([
        { status: ApprovalStatus.approved },
        { status: ApprovalStatus.rejected },
      ]);

      await expect(call()).resolves.toBe(false);
    });

    it('mode "all" needs every row approved', async () => {
      seedPolicies([
        policyRow({
          scope: ApprovalScope.task,
          domain: TaskDomain.food,
          mode: ApprovalMode.all,
        }),
      ]);

      prisma.approval.findMany.mockResolvedValue([
        { status: ApprovalStatus.approved },
        { status: ApprovalStatus.pending },
      ]);
      await expect(call()).resolves.toBe(false);

      prisma.approval.findMany.mockResolvedValue([
        { status: ApprovalStatus.approved },
        { status: ApprovalStatus.approved },
      ]);
      await expect(call()).resolves.toBe(true);
    });

    it('mode "n_of" is satisfied by min_approvals approved rows', async () => {
      seedPolicies([
        policyRow({
          scope: ApprovalScope.task,
          domain: TaskDomain.food,
          mode: ApprovalMode.n_of,
          min_approvals: 1,
        }),
      ]);
      prisma.approval.findMany.mockResolvedValue([
        { status: ApprovalStatus.approved },
        { status: ApprovalStatus.pending },
      ]);

      await expect(call()).resolves.toBe(true);
    });
  });

  describe('findAll', () => {
    it('lists the node’s policies ordered by scope then domain', async () => {
      const rows = [policyRow()];
      prisma.approvalPolicy.findMany.mockResolvedValue(rows);

      await expect(service.findAll()).resolves.toBe(rows);
      expect(prisma.approvalPolicy.findMany).toHaveBeenCalledWith({
        where: { node_id: DEFAULT_NODE_ID },
        orderBy: [{ scope: 'asc' }, { domain: 'asc' }],
      });
    });
  });

  describe('create', () => {
    const dto = {
      scope: ApprovalScope.vendor,
      domain: TaskDomain.procurement,
      required_role_codes: [RoleCode.PROCUREMENT_LEAD, RoleCode.BACKEND_LEAD],
      min_approvals: 2,
      mode: ApprovalMode.all,
    };

    it('creates the policy on the default node', async () => {
      prisma.approvalPolicy.findFirst.mockResolvedValue(null);
      prisma.approvalPolicy.create.mockResolvedValue(policyRow());

      await service.create({ ...dto });

      expect(prisma.approvalPolicy.create).toHaveBeenCalledWith({
        data: {
          node_id: DEFAULT_NODE_ID,
          scope: ApprovalScope.vendor,
          domain: TaskDomain.procurement,
          required_role_codes: [
            RoleCode.PROCUREMENT_LEAD,
            RoleCode.BACKEND_LEAD,
          ],
          min_approvals: 2,
          mode: ApprovalMode.all,
          is_default: false,
        },
      });
    });

    it('normalises an omitted domain to null', async () => {
      prisma.approvalPolicy.findFirst.mockResolvedValue(null);
      prisma.approvalPolicy.create.mockResolvedValue(policyRow());

      await service.create({ ...dto, domain: undefined });

      expect(prisma.approvalPolicy.findFirst).toHaveBeenCalledWith({
        where: {
          node_id: DEFAULT_NODE_ID,
          scope: ApprovalScope.vendor,
          domain: null,
        },
      });
      expect(prisma.approvalPolicy.create).toHaveBeenCalledWith({
        data: {
          node_id: DEFAULT_NODE_ID,
          scope: ApprovalScope.vendor,
          domain: null,
          required_role_codes: [
            RoleCode.PROCUREMENT_LEAD,
            RoleCode.BACKEND_LEAD,
          ],
          min_approvals: 2,
          mode: ApprovalMode.all,
          is_default: false,
        },
      });
    });

    it('throws BadRequestException on a duplicate (scope, domain)', async () => {
      prisma.approvalPolicy.findFirst.mockResolvedValue(policyRow());

      await expect(service.create({ ...dto })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.approvalPolicy.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when n_of min_approvals exceeds the role count', async () => {
      await expect(
        service.create({ ...dto, mode: ApprovalMode.n_of, min_approvals: 3 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.approvalPolicy.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException for an unknown id', async () => {
      prisma.approvalPolicy.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('patches only the supplied fields', async () => {
      prisma.approvalPolicy.findUnique.mockResolvedValue(policyRow());
      prisma.approvalPolicy.update.mockResolvedValue(policyRow());

      await service.update('policy-1', { min_approvals: 1 });

      expect(prisma.approvalPolicy.update).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
        data: { min_approvals: 1 },
      });
    });

    it('validates min_approvals against the merged role list', async () => {
      prisma.approvalPolicy.findUnique.mockResolvedValue(
        policyRow({ mode: ApprovalMode.n_of }),
      );

      await expect(
        service.update('policy-1', { min_approvals: 5 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.approvalPolicy.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for an unknown id', async () => {
      prisma.approvalPolicy.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to delete the is_default policy', async () => {
      prisma.approvalPolicy.findUnique.mockResolvedValue(
        policyRow({ is_default: true }),
      );

      await expect(service.remove('policy-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.approvalPolicy.delete).not.toHaveBeenCalled();
    });

    it('deletes a non-default policy', async () => {
      prisma.approvalPolicy.findUnique.mockResolvedValue(policyRow());
      prisma.approvalPolicy.delete.mockResolvedValue(policyRow());

      await service.remove('policy-1');

      expect(prisma.approvalPolicy.delete).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
      });
    });
  });
});
