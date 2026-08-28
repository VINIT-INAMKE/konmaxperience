import { Test, TestingModule } from '@nestjs/testing';
import {
  ActorType,
  ApprovalEntityType,
  ApprovalMode,
  ApprovalScope,
  ApprovalStatus,
  TaskDomain,
} from '@prisma/client';
import {
  ApprovalPolicyService,
  BACKFILL_AUDIT_ACTION,
} from '../approval-policy.service';
import { BACKFILL_VALIDATION_PORT } from '../backfill-validation.port';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { DEFAULT_NODE_ID } from '../../node/node.constants';
import { RoleCode } from '../../types/roles';
import {
  mockAuditService,
  mockPrisma,
  PRISMA_METHODS,
  type MockModel,
  type MockPrisma,
} from '../../test-utils/mock-providers';

/**
 * P3 decision 4 backfill — `ApprovalPolicyService.backfillMissing`.
 *
 * The prisma double carries a tiny in-memory `Approval` store so the same suite
 * can run the backfill twice and assert the second pass is a no-op, which is
 * the property that actually matters to an operator.
 */

type PolicyPrisma = MockPrisma & { approvalPolicy: MockModel };

interface TaskRow {
  id: string;
  node_id: string;
  domain: TaskDomain;
}

interface ApprovalWhere {
  entity_type?: ApprovalEntityType;
  entity_id?: string | { in: string[] };
}

interface CreateManyArgs {
  data: { entity_id: string; required_role_code: string }[];
}

const TASK_FOOD_POLICY = {
  id: 'policy-task-food',
  node_id: DEFAULT_NODE_ID,
  scope: ApprovalScope.task,
  domain: TaskDomain.food,
  required_role_codes: [RoleCode.BACKEND_LEAD, RoleCode.FRONTEND_LEAD],
  min_approvals: 2,
  mode: ApprovalMode.all,
  is_default: false,
};

describe('ApprovalPolicyService.backfillMissing (P3 decision 4)', () => {
  let service: ApprovalPolicyService;
  let prisma: PolicyPrisma;
  let audit: ReturnType<typeof mockAuditService>;
  let validation: { validateTask: jest.Mock };

  /** entity_id → the role codes that already have an `Approval` row. */
  let store: Map<string, string[]>;
  let tasks: TaskRow[];

  const task = (over: Partial<TaskRow> = {}): TaskRow => ({
    id: 'task-1',
    node_id: DEFAULT_NODE_ID,
    domain: TaskDomain.food,
    ...over,
  });

  beforeEach(async () => {
    store = new Map();
    tasks = [];

    prisma = mockPrisma({
      approvalPolicy: Object.fromEntries(
        PRISMA_METHODS.map((m) => [m, jest.fn()]),
      ),
    }) as PolicyPrisma;

    // The scan page. Every fixture here is smaller than one page, so the
    // service reads once and stops.
    prisma.task.findMany.mockImplementation(() => Promise.resolve(tasks));

    // Two callers land on `approval.findMany`: the backfill's page probe
    // (`entity_id: { in: [...] }`) and `materialise`'s per-entity role probe.
    prisma.approval.findMany.mockImplementation(
      (args: { where: ApprovalWhere }) => {
        const id = args.where.entity_id;
        if (id && typeof id === 'object' && 'in' in id) {
          return Promise.resolve(
            id.in
              .filter((entityId) => (store.get(entityId) ?? []).length > 0)
              .map((entityId) => ({ entity_id: entityId })),
          );
        }
        return Promise.resolve(
          (store.get(String(id)) ?? []).map((role) => ({
            required_role_code: role,
          })),
        );
      },
    );

    prisma.approval.createMany.mockImplementation((args: CreateManyArgs) => {
      for (const row of args.data) {
        const have = store.get(row.entity_id) ?? [];
        have.push(row.required_role_code);
        store.set(row.entity_id, have);
      }
      return Promise.resolve({ count: args.data.length });
    });

    prisma.approvalPolicy.findFirst.mockImplementation(
      (args: { where: { scope?: ApprovalScope; domain?: TaskDomain } }) =>
        Promise.resolve(
          args.where.scope === ApprovalScope.task &&
            args.where.domain === TaskDomain.food
            ? TASK_FOOD_POLICY
            : null,
        ),
    );

    audit = mockAuditService();
    validation = {
      validateTask: jest.fn().mockResolvedValue({
        valid: false,
        valid_xp: 0,
        newly_valid: false,
        user: { id: 'user-1', xp_total: 0, level: 1 },
        event: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: BACKFILL_VALIDATION_PORT, useValue: validation },
      ],
    }).compile();
    service = module.get<ApprovalPolicyService>(ApprovalPolicyService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('happy path — materialise, then revalidate', () => {
    beforeEach(() => {
      tasks = [task()];
    });

    it('materialises the policy rows and re-runs the cascade', async () => {
      const report = await service.backfillMissing(false);

      expect(report).toEqual({
        scanned: 1,
        materialised: 2,
        revalidated: 1,
        skipped: [],
      });
      expect(store.get('task-1')).toEqual([
        RoleCode.BACKEND_LEAD,
        RoleCode.FRONTEND_LEAD,
      ]);
      expect(validation.validateTask).toHaveBeenCalledTimes(1);
      expect(validation.validateTask).toHaveBeenCalledWith('task-1', prisma);
    });

    it('creates the rows BEFORE revalidating, inside one transaction', async () => {
      await service.backfillMissing(false);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(
        prisma.approval.createMany.mock.invocationCallOrder[0],
      ).toBeLessThan(validation.validateTask.mock.invocationCallOrder[0]);
    });

    it('writes the rows as pending under the resolved policy', async () => {
      await service.backfillMissing(false);

      const args = prisma.approval.createMany.mock
        .calls[0][0] as CreateManyArgs & {
        data: { status: ApprovalStatus; policy_id: string }[];
      };
      expect(args.data).toHaveLength(2);
      for (const row of args.data) {
        expect(row.status).toBe(ApprovalStatus.pending);
        expect(row.policy_id).toBe(TASK_FOOD_POLICY.id);
      }
    });

    it('audits each repaired task and never notifies', async () => {
      await service.backfillMissing(false);

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entity_type: 'task',
          entity_id: 'task-1',
          action: BACKFILL_AUDIT_ACTION,
          actor_type: ActorType.system,
          actor_id: null,
        }),
      );
      // `task.validated` is emitted by `emitTaskValidated`. The backfill's port
      // exposes `validateTask` and nothing else, so the pass structurally
      // cannot emit or notify — silent by design.
      expect(Object.keys(validation)).toEqual(['validateTask']);
    });

    it('leaves an already-covered task alone', async () => {
      store.set('task-1', [RoleCode.BACKEND_LEAD]);

      const report = await service.backfillMissing(false);

      expect(report).toEqual({
        scanned: 1,
        materialised: 0,
        revalidated: 0,
        skipped: [],
      });
      expect(prisma.approval.createMany).not.toHaveBeenCalled();
      expect(validation.validateTask).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('materialises 0 on the second run', async () => {
      tasks = [task(), task({ id: 'task-2' })];

      const first = await service.backfillMissing(false);
      expect(first).toMatchObject({
        scanned: 2,
        materialised: 4,
        revalidated: 2,
        skipped: [],
      });

      jest.clearAllMocks();
      const second = await service.backfillMissing(false);

      expect(second).toEqual({
        scanned: 2,
        materialised: 0,
        revalidated: 0,
        skipped: [],
      });
      expect(prisma.approval.createMany).not.toHaveBeenCalled();
      expect(validation.validateTask).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('a dry run writes nothing and leaves the second pass identical', async () => {
      tasks = [task()];

      const dry = await service.backfillMissing(true);

      expect(dry).toEqual({
        scanned: 1,
        materialised: 2,
        revalidated: 1,
        skipped: [],
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.approval.createMany).not.toHaveBeenCalled();
      expect(validation.validateTask).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(store.size).toBe(0);

      await expect(service.backfillMissing(true)).resolves.toEqual(dry);
    });
  });

  describe('zero-approver policies are skipped, never thrown', () => {
    beforeEach(() => {
      tasks = [task()];
    });

    it('skips a task whose policy resolves to no approvers', async () => {
      jest.spyOn(service, 'resolve').mockResolvedValue({
        policy_id: 'policy-empty',
        scope: ApprovalScope.task,
        domain: TaskDomain.food,
        required_role_codes: [],
        min_approvals: 1,
        mode: ApprovalMode.all,
      });

      const report = await service.backfillMissing(false);

      expect(report.materialised).toBe(0);
      expect(report.revalidated).toBe(0);
      expect(report.skipped).toEqual([
        {
          task_id: 'task-1',
          reason: expect.stringContaining('zero approvers'),
        },
      ]);
      expect(prisma.approval.createMany).not.toHaveBeenCalled();
      expect(validation.validateTask).not.toHaveBeenCalled();
    });

    it('skips a domain with no DOMAIN_LEAD_ROLE entry instead of writing a null role', async () => {
      // What `resolve` returns when the domain-lead substitution misses.
      jest.spyOn(service, 'resolve').mockResolvedValue({
        policy_id: null,
        scope: ApprovalScope.task,
        domain: TaskDomain.food,
        required_role_codes: [undefined as unknown as string],
        min_approvals: 1,
        mode: ApprovalMode.all,
      });

      const report = await service.backfillMissing(false);

      expect(report.skipped).toHaveLength(1);
      expect(prisma.approval.createMany).not.toHaveBeenCalled();
    });

    it('records a failed repair as a skip and keeps going', async () => {
      tasks = [task(), task({ id: 'task-2' })];
      validation.validateTask.mockRejectedValueOnce(new Error('boom'));

      const report = await service.backfillMissing(false);

      expect(report.scanned).toBe(2);
      expect(report.skipped).toEqual([{ task_id: 'task-1', reason: 'boom' }]);
      expect(report.revalidated).toBe(1);
      expect(validation.validateTask).toHaveBeenCalledTimes(2);
    });
  });

  describe('it never writes Approval rows directly', () => {
    it('delegates every write to materialise', async () => {
      tasks = [task()];
      const materialise = jest
        .spyOn(service, 'materialise')
        .mockResolvedValue(2);

      const report = await service.backfillMissing(false);

      expect(materialise).toHaveBeenCalledTimes(1);
      expect(materialise).toHaveBeenCalledWith(
        prisma,
        {
          entity_type: ApprovalEntityType.task,
          entity_id: 'task-1',
          scope: ApprovalScope.task,
          domain: TaskDomain.food,
        },
        DEFAULT_NODE_ID,
      );
      // With the single writer stubbed out, any row the backfill wrote itself
      // would show up here.
      expect(prisma.approval.create).not.toHaveBeenCalled();
      expect(prisma.approval.createMany).not.toHaveBeenCalled();
      expect(prisma.approval.upsert).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(report.materialised).toBe(2);
    });

    it('skips rather than double-counting when materialise finds the rows already there', async () => {
      tasks = [task()];
      jest.spyOn(service, 'materialise').mockResolvedValue(0);

      const report = await service.backfillMissing(false);

      expect(report.materialised).toBe(0);
      expect(report.revalidated).toBe(0);
      expect(report.skipped).toEqual([
        {
          task_id: 'task-1',
          reason: expect.stringContaining('between the scan and the write'),
        },
      ]);
      expect(validation.validateTask).not.toHaveBeenCalled();
    });
  });
});
