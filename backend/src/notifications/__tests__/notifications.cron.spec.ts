import { NotificationsCron } from '../notifications.cron';

describe('NotificationsCron', () => {
  let cron: NotificationsCron;
  let mockPrisma: any;
  let mockQueue: any;

  beforeEach(() => {
    mockPrisma = {
      task: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      approval: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };
    cron = new NotificationsCron(mockPrisma, mockQueue);
  });

  describe('scanTasksDue', () => {
    it('should enqueue jobs for tasks due within 48h', async () => {
      const now = Date.now();
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Fix widget',
          owner_user_id: 'user-1',
          due_date: new Date(now + 24 * 60 * 60 * 1000),
          quest: { title: 'Sprint 1' },
        },
        {
          id: 'task-2',
          title: 'Deploy service',
          owner_user_id: 'user-2',
          due_date: new Date(now + 36 * 60 * 60 * 1000),
          quest: { title: 'Sprint 2' },
        },
      ]);

      await cron.scanTasksDue();

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'notify-task-due',
        expect.objectContaining({
          taskId: 'task-1',
          taskTitle: 'Fix widget',
          ownerUserId: 'user-1',
        }),
        expect.objectContaining({ attempts: 2 }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'notify-task-due',
        expect.objectContaining({
          taskId: 'task-2',
          taskTitle: 'Deploy service',
          ownerUserId: 'user-2',
        }),
        expect.objectContaining({ attempts: 2 }),
      );
    });

    it('should skip tasks without owner_user_id', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-orphan',
          title: 'No owner',
          owner_user_id: null,
          due_date: new Date(Date.now() + 12 * 60 * 60 * 1000),
          quest: null,
        },
      ]);

      await cron.scanTasksDue();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should not throw when prisma.task.findMany fails', async () => {
      mockPrisma.task.findMany.mockRejectedValue(new Error('DB down'));

      await expect(cron.scanTasksDue()).resolves.toBeUndefined();
    });
  });

  describe('scanApprovalsPending', () => {
    it('should enqueue jobs for approvals pending >24h', async () => {
      mockPrisma.approval.findMany.mockResolvedValue([
        {
          id: 'approval-1',
          entity_id: 'task-100',
          task: { id: 'task-100', title: 'Review evidence' },
        },
      ]);

      await cron.scanApprovalsPending();

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'notify-approval-pending',
        expect.objectContaining({
          approvalId: 'approval-1',
          taskId: 'task-100',
          taskTitle: 'Review evidence',
        }),
        expect.objectContaining({ attempts: 2 }),
      );
    });

    it('should use entity_id as taskId when task relation is null', async () => {
      mockPrisma.approval.findMany.mockResolvedValue([
        {
          id: 'approval-2',
          entity_id: 'entity-999',
          task: null,
        },
      ]);

      await cron.scanApprovalsPending();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'notify-approval-pending',
        expect.objectContaining({
          taskId: 'entity-999',
          taskTitle: 'Unknown Task',
        }),
        expect.any(Object),
      );
    });

    it('should not throw when prisma.approval.findMany fails', async () => {
      mockPrisma.approval.findMany.mockRejectedValue(
        new Error('Connection lost'),
      );

      await expect(cron.scanApprovalsPending()).resolves.toBeUndefined();
    });
  });
});
