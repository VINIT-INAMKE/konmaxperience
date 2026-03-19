import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { Permission } from '../types/permissions';

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
    created_at: new Date(),
    updated_at: new Date(),
    owner: { id: 'user-1', name: 'Test User' },
    creator: { id: 'admin-1', name: 'Admin' },
    depends_on: null,
  };

  beforeEach(async () => {
    txMock = {
      task: {
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      quest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      mission: {
        update: jest.fn(),
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
      $transaction: jest.fn((cb: any) => cb(txMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

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
  });

  describe('create', () => {
    it('creates task with correct task_type including adhoc', async () => {
      const dto = {
        mission_id: 'mission-1',
        quest_id: 'quest-1',
        title: 'Ad-hoc fix',
        description: 'Quick fix needed',
        task_type: 'adhoc',
        domain: 'tech',
        owner_user_id: 'user-1',
        priority: 'high',
      };
      prisma.task.create.mockResolvedValue({
        id: 'task-new',
        ...dto,
        created_by: 'admin-1',
      });

      const result = await service.create(dto as any, 'admin-1');

      expect(result.task_type).toBe('adhoc');
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            task_type: 'adhoc',
            created_by: 'admin-1',
          }),
        }),
      );
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
      txMock.task.findMany.mockResolvedValue([]);
      txMock.mission.update.mockResolvedValue({});

      const result = await service.block(
        'task-1',
        'Waiting for design assets',
        regularUser,
      );

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

    it('throws ForbiddenException for non-owner without UPDATE_ANY_TASK', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask); // owned by user-1
      mockGetPermissions.mockResolvedValue([Permission.UPDATE_OWN_TASK]); // user-2 can only update own

      await expect(
        service.block('task-1', 'Some reason', otherUser),
      ).rejects.toThrow(ForbiddenException);
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
      txMock.task.count.mockResolvedValue(0);
      txMock.quest.update.mockResolvedValue({});
      txMock.task.findMany.mockResolvedValue([]);
      txMock.mission.update.mockResolvedValue({});

      await service.update('task-1', { status: 'doing' }, regularUser);

      // Verify $transaction was called (wraps update + recalculation)
      expect(prisma.$transaction).toHaveBeenCalled();

      // Verify quest progress recalculated (quest.findUnique + task.count + quest.update)
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

      // 3 core valid tasks (seeded with valid=true for test)
      txMock.task.count
        .mockResolvedValueOnce(3)  // core valid count
        .mockResolvedValueOnce(0)  // total adhoc
        .mockResolvedValueOnce(0); // valid adhoc

      txMock.quest.update.mockResolvedValue({});

      // Mission recalculation
      txMock.task.findMany.mockResolvedValue([]);
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
      txMock.task.count.mockResolvedValue(0);
      txMock.quest.update.mockResolvedValue({});
      txMock.task.findMany.mockResolvedValue([]);
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
      txMock.task.count
        .mockResolvedValueOnce(3)  // core valid count
        .mockResolvedValueOnce(2)  // total adhoc
        .mockResolvedValueOnce(1); // valid adhoc

      txMock.quest.update.mockResolvedValue({});
      txMock.task.findMany.mockResolvedValue([]);
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

      // Mission has 10 tasks, 4 valid (seeded with valid=true for test)
      txMock.task.findMany.mockResolvedValue([
        { valid: true },
        { valid: true },
        { valid: true },
        { valid: true },
        { valid: false },
        { valid: false },
        { valid: false },
        { valid: false },
        { valid: false },
        { valid: false },
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
