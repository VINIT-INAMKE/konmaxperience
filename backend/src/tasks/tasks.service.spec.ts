import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalPolicyService } from '../approvals/approval-policy.service';
import { Permission } from '../types/permissions';
import {
  mockApprovalPolicyService,
  mockAuditService,
  mockEventEmitter,
  provideAuditService,
  provideEventEmitter,
} from '../test-utils/mock-providers';

// NOTE: In production, valid=true is set by Phase 3 evidence/approval flow.
// Tests seed valid=true directly to verify recalculation math.

jest.mock('../permissions/permissions.cache', () => ({
  getPermissionsForRole: jest.fn(),
}));

import { getPermissionsForRole } from '../permissions/permissions.cache';
const mockGetPermissions = getPermissionsForRole as jest.MockedFunction<
  typeof getPermissionsForRole
>;

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;
  let txMock: any;
  let audit: ReturnType<typeof mockAuditService>;
  let approvalPolicy: ReturnType<typeof mockApprovalPolicyService>;
  let emitter: ReturnType<typeof mockEventEmitter>;

  const adminUser = { id: 'admin-1', roleCode: 'FOUNDER_ADMIN' };
  const regularUser = { id: 'user-1', roleCode: 'FRONTEND_LEAD' };
  const otherUser = { id: 'user-2', roleCode: 'TALENT_LEAD' };

  const mockTask = {
    id: 'task-1',
    mission_id: 'mission-1',
    quest_id: 'quest-1',
    title: 'Design homepage',
    description: 'Create the homepage design',
    task_type: 'core',
    domain: 'tech',
    owner_user_id: 'user-1',
    created_by: 'admin-1',
    status: 'todo',
    priority: 'medium',
    xp: 25,
    valid_xp: 0,
    verified: false,
    valid: false,
    requires_approval: true,
    blocked: false,
    blocked_reason: null,
    depends_on_task_id: null,
    node_id: 'node-1',
    created_at: new Date(),
    updated_at: new Date(),
    owner: { id: 'user-1', name: 'Test User' },
    creator: { id: 'admin-1', name: 'Admin' },
    depends_on: null,
  };

  beforeEach(async () => {
    txMock = {
      task: {
        create: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      quest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      mission: {
        update: jest.fn(),
      },
      approval: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      auditEvent: {
        create: jest.fn(),
      },
    };

    prisma = {
      task: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      quest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      mission: {
        update: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      approval: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb: any) => cb(txMock)),
    };

    audit = mockAuditService();
    approvalPolicy = mockApprovalPolicyService();
    emitter = mockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        provideEventEmitter(emitter),
        provideAuditService(audit),
        { provide: ApprovalPolicyService, useValue: approvalPolicy },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  /** Dispatch tx.task.groupBy on the where clause so Promise.all ordering does not matter. */
  const mockGroupBy = (
    quest: Array<{ task_type: 'core' | 'adhoc'; valid: boolean; count: number }>,
    mission: Array<{ valid: boolean; count: number }>,
  ) =>
    txMock.task.groupBy.mockImplementation(
      ({ where }: { where: { quest_id?: string; mission_id?: string } }) =>
        Promise.resolve(
          where.quest_id
            ? quest.map((g) => ({ task_type: g.task_type, valid: g.valid, _count: { id: g.count } }))
            : mission.map((g) => ({ valid: g.valid, _count: { id: g.count } })),
        ),
    );

  describe('findAll', () => {
    it('returns only tasks where owner_user_id matches for non-admin user', async () => {
      mockGetPermissions.mockResolvedValue([
        Permission.VIEW_ROLE_SCOPED,
        Permission.UPDATE_OWN_TASK,
      ]);
      prisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await service.findAll(regularUser, {});

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            owner_user_id: 'user-1',
          }),
        }),
      );
      expect(result[0].is_own).toBe(true);
    });

    it('returns all tasks in quest with is_own flag in quest context mode', async () => {
      mockGetPermissions.mockResolvedValue([
        Permission.VIEW_ROLE_SCOPED,
        Permission.UPDATE_OWN_TASK,
      ]);

      const ownTask = { ...mockTask, owner_user_id: 'user-1' };
      const otherTask = { ...mockTask, id: 'task-2', owner_user_id: 'user-2' };
      prisma.task.findMany.mockResolvedValue([ownTask, otherTask]);

      const result = await service.findAll(regularUser, {
        questId: 'quest-1',
      });

      // Quest context: no owner_user_id filter in where
      const callArgs = prisma.task.findMany.mock.calls[0][0];
      expect(callArgs.where.quest_id).toBe('quest-1');
      expect(callArgs.where.owner_user_id).toBeUndefined();

      // is_own flag set correctly
      expect(result[0].is_own).toBe(true); // own task
      expect(result[1].is_own).toBe(false); // other user's task
    });

    it('applies viewAs filter for admin users', async () => {
      mockGetPermissions.mockResolvedValue([
        Permission.VIEW_ALL,
        Permission.UPDATE_ANY_TASK,
      ]);
      prisma.task.findMany.mockResolvedValue([mockTask]);

      await service.findAll(adminUser, { viewAs: 'user-2' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            owner_user_id: 'user-2',
          }),
        }),
      );
    });

    it('attaches pending_approvals per task from one grouped count', async () => {
      mockGetPermissions.mockResolvedValue([
        Permission.VIEW_ALL,
        Permission.UPDATE_ANY_TASK,
      ]);
      prisma.task.findMany.mockResolvedValue([
        mockTask,
        { ...mockTask, id: 'task-2' },
      ]);
      prisma.approval.groupBy.mockResolvedValue([
        { entity_id: 'task-1', _count: { id: 2 } },
      ]);

      const result = await service.findAll(adminUser, {});

      expect(prisma.approval.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['entity_id'],
          where: expect.objectContaining({
            entity_type: 'task',
            entity_id: { in: ['task-1', 'task-2'] },
            status: 'pending',
          }),
        }),
      );
      expect(result[0].pending_approvals).toBe(2);
      expect(result[1].pending_approvals).toBe(0);
    });

    it('skips the approval count query when no tasks match', async () => {
      mockGetPermissions.mockResolvedValue([Permission.VIEW_ALL]);
      prisma.task.findMany.mockResolvedValue([]);

      await service.findAll(adminUser, {});

      expect(prisma.approval.groupBy).not.toHaveBeenCalled();
    });

    // ── IA-04: mine / status list / cursor pagination ──────────────────────

    it('narrows an admin to their own tasks when mine is true', async () => {
      mockGetPermissions.mockResolvedValue([Permission.VIEW_ALL]);
      prisma.task.findMany.mockResolvedValue([mockTask]);

      await service.findAll(adminUser, { mine: true });

      expect(prisma.task.findMany.mock.calls[0][0].where).toMatchObject({
        owner_user_id: 'admin-1',
      });
    });

    it('turns a comma-separated status into an `in` filter', async () => {
      mockGetPermissions.mockResolvedValue([Permission.VIEW_ALL]);
      prisma.task.findMany.mockResolvedValue([]);

      await service.findAll(adminUser, { status: 'todo,doing' });

      expect(prisma.task.findMany.mock.calls[0][0].where.status).toEqual({
        in: ['todo', 'doing'],
      });
    });

    it('keeps a single status as a scalar', async () => {
      mockGetPermissions.mockResolvedValue([Permission.VIEW_ALL]);
      prisma.task.findMany.mockResolvedValue([]);

      await service.findAll(adminUser, { status: 'todo' });

      expect(prisma.task.findMany.mock.calls[0][0].where.status).toBe('todo');
    });

    it('throws BadRequestException for a status outside the enum', async () => {
      mockGetPermissions.mockResolvedValue([Permission.VIEW_ALL]);

      await expect(
        service.findAll(adminUser, { status: 'bogus' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('returns a cursor page when limit is supplied', async () => {
      mockGetPermissions.mockResolvedValue([Permission.VIEW_ALL]);
      prisma.task.findMany.mockResolvedValue([
        mockTask,
        { ...mockTask, id: 'task-2' },
        { ...mockTask, id: 'task-3' },
      ]);

      const result = (await service.findAll(adminUser, {
        limit: 2,
      })) as { items: any[]; next_cursor: string | null; has_more: boolean };

      // take is limit + 1 so "is there another page?" costs no extra query.
      expect(prisma.task.findMany.mock.calls[0][0].take).toBe(3);
      expect(result.items.map((t) => t.id)).toEqual(['task-1', 'task-2']);
      expect(result.next_cursor).toBe('task-2');
      expect(result.has_more).toBe(true);
      // The over-fetched row is not counted for approval chips.
      expect(prisma.approval.groupBy.mock.calls[0][0].where.entity_id).toEqual({
        in: ['task-1', 'task-2'],
      });
    });

    it('reports has_more false and a null cursor on the last page', async () => {
      mockGetPermissions.mockResolvedValue([Permission.VIEW_ALL]);
      prisma.task.findMany.mockResolvedValue([mockTask]);

      const result = (await service.findAll(adminUser, {
        cursor: 'task-0',
        limit: 2,
      })) as { items: any[]; next_cursor: string | null; has_more: boolean };

      expect(prisma.task.findMany.mock.calls[0][0]).toMatchObject({
        cursor: { id: 'task-0' },
        skip: 1,
      });
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeNull();
    });

    it('keeps the legacy bare-array shape when neither cursor nor limit is sent', async () => {
      mockGetPermissions.mockResolvedValue([Permission.VIEW_ALL]);
      prisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await service.findAll(adminUser, {});

      expect(Array.isArray(result)).toBe(true);
      expect(prisma.task.findMany.mock.calls[0][0].take).toBe(200);
      expect(prisma.task.findMany.mock.calls[0][0].cursor).toBeUndefined();
    });
  });

  describe('create', () => {
    const createDto = {
      mission_id: 'mission-1',
      quest_id: 'quest-1',
      title: 'Ad-hoc fix',
      description: 'Quick fix needed',
      task_type: 'adhoc',
      domain: 'tech',
      owner_user_id: 'user-1',
      priority: 'high',
    };

    /** The row `tx.task.create` resolves with, merged with per-test overrides. */
    const mockCreated = (overrides: Record<string, unknown> = {}) => {
      const created = {
        id: 'task-new',
        node_id: 'node-1',
        status: 'todo',
        requires_approval: true,
        subject_type: null,
        subject_id: null,
        ...createDto,
        created_by: 'admin-1',
        ...overrides,
      };
      txMock.task.create.mockResolvedValue(created);
      return created;
    };

    it('creates task with correct task_type including adhoc', async () => {
      mockCreated();

      const result = await service.create(createDto as any, 'admin-1');

      expect(result.task_type).toBe('adhoc');
      expect(txMock.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            task_type: 'adhoc',
            created_by: 'admin-1',
          }),
        }),
      );
    });

    it('materialises policy approvals for the default requires_approval=true', async () => {
      mockCreated();

      await service.create(createDto as any, 'admin-1');

      expect(txMock.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ requires_approval: true }),
        }),
      );
      expect(approvalPolicy.materialise).toHaveBeenCalledWith(
        txMock,
        {
          entity_type: 'task',
          entity_id: 'task-new',
          scope: 'task',
          domain: 'tech',
        },
        'node-1',
      );
    });

    it('does not materialise approvals when requires_approval is false', async () => {
      mockCreated({ requires_approval: false });

      await service.create(
        { ...createDto, requires_approval: false } as any,
        'admin-1',
      );

      expect(approvalPolicy.materialise).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when only subject_type is provided', async () => {
      await expect(
        service.create(
          { ...createDto, subject_type: 'recipe' } as any,
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('writes subject_type and subject_id through to task.create', async () => {
      mockCreated({ subject_type: 'recipe', subject_id: 'recipe-1' });

      await service.create(
        {
          ...createDto,
          subject_type: 'recipe',
          subject_id: 'recipe-1',
        } as any,
        'admin-1',
      );

      expect(txMock.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subject_type: 'recipe',
            subject_id: 'recipe-1',
          }),
        }),
      );
    });

    it('records a task.created AuditEvent inside the transaction', async () => {
      mockCreated();

      await service.create(createDto as any, 'admin-1');

      expect(audit.record).toHaveBeenCalledWith(txMock, {
        entity_type: 'task',
        entity_id: 'task-new',
        action: 'task.created',
        actor_type: 'user',
        actor_id: 'admin-1',
        after: {
          status: 'todo',
          domain: 'tech',
          requires_approval: true,
        },
      });
    });
  });

  describe('block', () => {
    it('sets status=blocked, blocked=true, blocked_reason when authorized', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);

      const updatedTask = {
        ...mockTask,
        status: 'blocked',
        blocked: true,
        blocked_reason: 'Waiting for design assets',
      };
      txMock.task.update.mockResolvedValue(updatedTask);
      txMock.quest.findUnique.mockResolvedValue(null);
      mockGroupBy([], []);
      txMock.mission.update.mockResolvedValue({});

      await service.block('task-1', 'Waiting for design assets', regularUser);

      expect(txMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            status: 'blocked',
            blocked: true,
            blocked_reason: 'Waiting for design assets',
          }),
        }),
      );
    });

    it('records a task.blocked AuditEvent inside the transaction', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);
      txMock.task.update.mockResolvedValue({
        ...mockTask,
        status: 'blocked',
        blocked: true,
        blocked_reason: 'Waiting for design assets',
      });
      txMock.quest.findUnique.mockResolvedValue(null);
      mockGroupBy([], []);
      txMock.mission.update.mockResolvedValue({});

      await service.block('task-1', 'Waiting for design assets', regularUser);

      expect(audit.record).toHaveBeenCalledWith(txMock, {
        entity_type: 'task',
        entity_id: 'task-1',
        action: 'task.blocked',
        actor_type: 'user',
        actor_id: 'user-1',
        before: { status: 'todo' },
        after: {
          status: 'blocked',
          blocked_reason: 'Waiting for design assets',
        },
      });
    });

    it('emits the typed task.blocked domain event after the transaction', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);
      txMock.task.update.mockResolvedValue({
        ...mockTask,
        status: 'blocked',
        blocked: true,
        blocked_reason: 'Waiting for design assets',
      });
      txMock.quest.findUnique.mockResolvedValue(null);
      mockGroupBy([], []);
      txMock.mission.update.mockResolvedValue({});

      await service.block('task-1', 'Waiting for design assets', regularUser);

      expect(emitter.emit).toHaveBeenCalledWith(
        'task.blocked',
        expect.objectContaining({
          node_id: 'node-1',
          actor: { actor_type: 'user', actor_id: 'user-1' },
          occurred_at: expect.any(String),
          taskId: 'task-1',
          taskTitle: 'Design homepage',
          ownerUserId: 'user-1',
          blockedReason: 'Waiting for design assets',
        }),
      );
    });

    it('throws ForbiddenException for non-owner without UPDATE_ANY_TASK', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask); // owned by user-1
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]); // user-2 can only update own

      await expect(
        service.block('task-1', 'Some reason', otherUser),
      ).rejects.toThrow(ForbiddenException);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('calls recalculateQuestProgress and recalculateMissionProgress in transaction on status change', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask); // status: 'todo'
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);

      txMock.task.update.mockResolvedValue({
        ...mockTask,
        status: 'doing',
      });
      txMock.quest.findUnique.mockResolvedValue({
        id: 'quest-1',
        baseline_task_count: 5,
      });
      mockGroupBy([], []);
      txMock.quest.update.mockResolvedValue({});
      txMock.mission.update.mockResolvedValue({});

      await service.update('task-1', { status: 'doing' }, regularUser);

      // Verify $transaction was called (wraps update + recalculation)
      expect(prisma.$transaction).toHaveBeenCalled();

      // Verify quest progress recalculated (quest.findUnique + task.groupBy + quest.update)
      expect(txMock.quest.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'quest-1' } }),
      );
      expect(txMock.quest.update).toHaveBeenCalled();

      // Verify mission progress recalculated
      expect(txMock.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mission-1' },
          data: expect.objectContaining({ progress_percent: expect.any(Number) }),
        }),
      );
    });

    it('records a task.status_changed AuditEvent with the tx client', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask); // status: 'todo'
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);

      txMock.task.update.mockResolvedValue({ ...mockTask, status: 'doing' });
      txMock.quest.findUnique.mockResolvedValue({
        id: 'quest-1',
        baseline_task_count: 5,
      });
      mockGroupBy([], []);
      txMock.quest.update.mockResolvedValue({});
      txMock.mission.update.mockResolvedValue({});

      await service.update('task-1', { status: 'doing' }, regularUser);

      expect(audit.record).toHaveBeenCalledWith(txMock, {
        entity_type: 'task',
        entity_id: 'task-1',
        action: 'task.status_changed',
        actor_type: 'user',
        actor_id: 'user-1',
        before: { status: 'todo' },
        after: { status: 'doing' },
      });
    });

    it('does not audit when the status is unchanged', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);
      txMock.task.update.mockResolvedValue(mockTask);

      await service.update('task-1', { title: 'Renamed' }, regularUser);

      expect(audit.record).not.toHaveBeenCalled();
    });

    it('stamps updated_by with the requesting user', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);
      txMock.task.update.mockResolvedValue(mockTask);

      await service.update('task-1', { title: 'Renamed' }, regularUser);

      expect(txMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ updated_by: 'user-1' }),
        }),
      );
    });

    it('materialises approvals when requires_approval flips false → true', async () => {
      prisma.task.findUnique.mockResolvedValue({
        ...mockTask,
        requires_approval: false,
      });
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_ANY_TASK]);
      txMock.task.update.mockResolvedValue({
        ...mockTask,
        requires_approval: true,
      });

      await service.update('task-1', { requires_approval: true }, adminUser);

      expect(approvalPolicy.materialise).toHaveBeenCalledWith(
        txMock,
        {
          entity_type: 'task',
          entity_id: 'task-1',
          scope: 'task',
          domain: 'tech',
        },
        'node-1',
      );
      expect(txMock.approval.deleteMany).not.toHaveBeenCalled();
    });

    it('clears pending approvals and audits when requires_approval flips true → false', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask); // requires_approval: true
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_ANY_TASK]);
      txMock.task.update.mockResolvedValue({
        ...mockTask,
        requires_approval: false,
      });

      await service.update('task-1', { requires_approval: false }, adminUser);

      expect(txMock.approval.deleteMany).toHaveBeenCalledWith({
        where: {
          entity_type: 'task',
          entity_id: 'task-1',
          status: 'pending',
        },
      });
      expect(approvalPolicy.materialise).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(txMock, {
        entity_type: 'task',
        entity_id: 'task-1',
        action: 'task.approvals_cleared',
        actor_type: 'user',
        actor_id: 'admin-1',
        before: { requires_approval: true },
        after: { requires_approval: false },
      });
    });

    it('re-materialises with the new domain when domain changes on a gated task', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask); // domain: 'tech'
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_ANY_TASK]);
      txMock.task.update.mockResolvedValue({ ...mockTask, domain: 'food' });

      await service.update('task-1', { domain: 'food' } as any, adminUser);

      // Rows generated under the OLD domain go first, then the new policy runs.
      expect(txMock.approval.deleteMany).toHaveBeenCalledWith({
        where: {
          entity_type: 'task',
          entity_id: 'task-1',
          status: 'pending',
        },
      });
      expect(approvalPolicy.materialise).toHaveBeenCalledWith(
        txMock,
        {
          entity_type: 'task',
          entity_id: 'task-1',
          scope: 'task',
          domain: 'food',
        },
        'node-1',
      );
    });

    it('leaves approvals alone when domain changes on an ungated task', async () => {
      prisma.task.findUnique.mockResolvedValue({
        ...mockTask,
        requires_approval: false,
      });
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_ANY_TASK]);
      txMock.task.update.mockResolvedValue({
        ...mockTask,
        requires_approval: false,
        domain: 'food',
      });

      await service.update('task-1', { domain: 'food' } as any, adminUser);

      expect(approvalPolicy.materialise).not.toHaveBeenCalled();
      expect(txMock.approval.deleteMany).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when only subject_id is provided', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_ANY_TASK]);

      await expect(
        service.update('task-1', { subject_id: 'recipe-1' } as any, adminUser),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('unblock', () => {
    it('records a task.unblocked AuditEvent inside the transaction', async () => {
      prisma.task.findUnique.mockResolvedValue({
        ...mockTask,
        status: 'blocked',
        blocked: true,
        blocked_reason: 'Waiting for design assets',
      });
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);
      txMock.task.update.mockResolvedValue({ ...mockTask, status: 'todo' });
      txMock.quest.findUnique.mockResolvedValue(null);
      mockGroupBy([], []);
      txMock.mission.update.mockResolvedValue({});

      await service.unblock('task-1', regularUser);

      expect(audit.record).toHaveBeenCalledWith(txMock, {
        entity_type: 'task',
        entity_id: 'task-1',
        action: 'task.unblocked',
        actor_type: 'user',
        actor_id: 'user-1',
        before: {
          status: 'blocked',
          blocked_reason: 'Waiting for design assets',
        },
        after: { status: 'todo', blocked_reason: null },
      });
    });
  });

  describe('progress recalculation', () => {
    // NOTE: In production, valid=true is set by Phase 3 evidence/approval flow.
    // Tests seed valid=true directly to verify recalculation math.

    it('uses baseline_task_count as denominator for core_progress_percent', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);

      txMock.task.update.mockResolvedValue({ ...mockTask, status: 'done' });

      // Quest with baseline_task_count=5
      txMock.quest.findUnique.mockResolvedValue({
        id: 'quest-1',
        baseline_task_count: 5,
      });

      // 3 core valid tasks (seeded with valid=true for test), no adhoc; mission has no tasks
      mockGroupBy([{ task_type: 'core', valid: true, count: 3 }], []);

      txMock.quest.update.mockResolvedValue({});
      txMock.mission.update.mockResolvedValue({});

      await service.update('task-1', { status: 'done' }, regularUser);

      // core_progress_percent = Math.round((3 / 5) * 100) = 60
      expect(txMock.quest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            core_progress_percent: 60,
          }),
        }),
      );
    });

    it('does not modify quest.status during recalculation', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);

      txMock.task.update.mockResolvedValue({ ...mockTask, status: 'done' });
      txMock.quest.findUnique.mockResolvedValue({
        id: 'quest-1',
        baseline_task_count: 5,
      });
      mockGroupBy([], []);
      txMock.quest.update.mockResolvedValue({});
      txMock.mission.update.mockResolvedValue({});

      await service.update('task-1', { status: 'done' }, regularUser);

      // Verify quest.update data does NOT contain status key
      const questUpdateCall = txMock.quest.update.mock.calls[0][0];
      expect(questUpdateCall.data).not.toHaveProperty('status');
    });

    it('adding adhoc task does not change core_progress_percent value', async () => {
      prisma.task.findUnique.mockResolvedValue({
        ...mockTask,
        quest_id: 'quest-1',
      });
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);

      txMock.task.update.mockResolvedValue({ ...mockTask, status: 'done' });

      // Quest with baseline_task_count=5
      txMock.quest.findUnique.mockResolvedValue({
        id: 'quest-1',
        baseline_task_count: 5,
      });

      // Scenario: 3 core valid, 2 total adhoc, 1 valid adhoc
      // core_progress = Math.round((3 / 5) * 100) = 60
      // adhoc_progress = Math.round((1 / 2) * 100) = 50
      // combined = Math.round(((3 + 1 * 0.7) / (5 + 2 * 0.7)) * 100) = Math.round((3.7 / 6.4) * 100) = 58
      mockGroupBy(
        [
          { task_type: 'core', valid: true, count: 3 },
          { task_type: 'adhoc', valid: true, count: 1 },
          { task_type: 'adhoc', valid: false, count: 1 },
        ],
        [],
      );

      txMock.quest.update.mockResolvedValue({});
      txMock.mission.update.mockResolvedValue({});

      await service.update('task-1', { status: 'done' }, regularUser);

      const questUpdateData = txMock.quest.update.mock.calls[0][0].data;
      // Core progress uses baseline_task_count (5), NOT baseline + adhoc
      expect(questUpdateData.core_progress_percent).toBe(60);
      // Adhoc progress is separate
      expect(questUpdateData.adhoc_progress_percent).toBe(50);
      // Combined uses weighted formula
      expect(questUpdateData.progress_percent).toBe(58);
    });

    it('recalculateMissionProgress counts valid tasks over total tasks', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]);

      txMock.task.update.mockResolvedValue({ ...mockTask, status: 'done' });
      txMock.quest.findUnique.mockResolvedValue(null); // no quest

      // Mission has 10 tasks, 4 valid — mocked via task.groupBy
      mockGroupBy([], [
        { valid: true, count: 4 },
        { valid: false, count: 6 },
      ]);
      txMock.mission.update.mockResolvedValue({});

      await service.update('task-1', { status: 'done' }, regularUser);

      // progress = Math.round((4 / 10) * 100) = 40
      expect(txMock.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mission-1' },
          data: { progress_percent: 40 },
        }),
      );
    });
  });
});
