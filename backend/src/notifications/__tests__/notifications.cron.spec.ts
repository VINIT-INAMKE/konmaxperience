import { NotificationsCron } from '../notifications.cron';
import { mockPrisma, mockQstash } from '../../test-utils/mock-providers';

const HOUR = 60 * 60 * 1000;

describe('NotificationsCron', () => {
  let cron: NotificationsCron;
  let prisma: ReturnType<typeof mockPrisma>;
  let qstash: ReturnType<typeof mockQstash>;

  beforeEach(() => {
    prisma = mockPrisma();
    prisma.task.findMany.mockResolvedValue([]);
    prisma.approval.findMany.mockResolvedValue([]);
    qstash = mockQstash();
    cron = new NotificationsCron(prisma as any, qstash as any);
  });

  describe('scanTasksDue', () => {
    it('queries through withReconnect for open tasks due within 48h', async () => {
      await cron.scanTasksDue();

      expect(prisma.withReconnect).toHaveBeenCalledTimes(1);
      expect(prisma.task.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            due_date: { lte: expect.any(Date), gt: expect.any(Date) },
            status: { notIn: ['done', 'cancelled', 'blocked'] },
          }),
          select: expect.objectContaining({
            id: true,
            title: true,
            owner_user_id: true,
            due_date: true,
            quest: { select: { title: true } },
          }),
        }),
      );
      expect(qstash.publish).not.toHaveBeenCalled();
    });

    it('publishes notify-task-due for each owned task due within 48h', async () => {
      const now = Date.now();
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Fix widget',
          owner_user_id: 'user-1',
          due_date: new Date(now + 24 * HOUR),
          quest: { title: 'Sprint 1' },
        },
        {
          id: 'task-2',
          title: 'Deploy service',
          owner_user_id: 'user-2',
          due_date: new Date(now + 36 * HOUR),
          quest: { title: 'Sprint 2' },
        },
      ]);

      await cron.scanTasksDue();

      expect(prisma.withReconnect).toHaveBeenCalledTimes(1);
      expect(qstash.publish).toHaveBeenCalledTimes(2);
      expect(qstash.publish).toHaveBeenCalledWith('notify-task-due', {
        taskId: 'task-1',
        taskName: 'Fix widget',
        questName: 'Sprint 1',
        userId: 'user-1',
        hours: 24,
      });
      expect(qstash.publish).toHaveBeenCalledWith('notify-task-due', {
        taskId: 'task-2',
        taskName: 'Deploy service',
        questName: 'Sprint 2',
        userId: 'user-2',
        hours: 36,
      });
    });

    it("falls back to 'Unknown Quest' when the quest relation is null", async () => {
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-3',
          title: 'Orphan quest',
          owner_user_id: 'user-3',
          due_date: new Date(Date.now() + 6 * HOUR),
          quest: null,
        },
      ]);

      await cron.scanTasksDue();

      expect(qstash.publish).toHaveBeenCalledWith(
        'notify-task-due',
        expect.objectContaining({ taskId: 'task-3', questName: 'Unknown Quest', hours: 6 }),
      );
    });

    it('skips tasks without owner_user_id', async () => {
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-orphan',
          title: 'No owner',
          owner_user_id: null,
          due_date: new Date(Date.now() + 12 * HOUR),
          quest: null,
        },
      ]);

      await cron.scanTasksDue();

      expect(qstash.publish).not.toHaveBeenCalled();
    });

    it('does not throw when prisma.task.findMany fails', async () => {
      prisma.task.findMany.mockRejectedValue(new Error('DB down'));

      await expect(cron.scanTasksDue()).resolves.toBeUndefined();
      expect(qstash.publish).not.toHaveBeenCalled();
    });

    it('does not throw when qstash.publish fails', async () => {
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Fix widget',
          owner_user_id: 'user-1',
          due_date: new Date(Date.now() + 24 * HOUR),
          quest: { title: 'Sprint 1' },
        },
      ]);
      qstash.publish.mockRejectedValue(new Error('QStash down'));

      await expect(cron.scanTasksDue()).resolves.toBeUndefined();
    });
  });

  describe('scanApprovalsPending', () => {
    const created = new Date(Date.now() - 30 * HOUR);

    it('queries through withReconnect for pending approvals older than 24h', async () => {
      await cron.scanApprovalsPending();

      expect(prisma.withReconnect).toHaveBeenCalledTimes(1);
      expect(prisma.approval.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending', created_at: { lt: expect.any(Date) } },
          select: expect.objectContaining({
            id: true,
            entity_id: true,
            created_at: true,
            task: { select: { id: true, title: true } },
          }),
        }),
      );
      expect(qstash.publish).not.toHaveBeenCalled();
    });

    it('publishes notify-approval-pending for approvals pending >24h', async () => {
      prisma.approval.findMany.mockResolvedValue([
        {
          id: 'approval-1',
          entity_id: 'task-100',
          created_at: created,
          task: { id: 'task-100', title: 'Review evidence' },
        },
      ]);

      await cron.scanApprovalsPending();

      expect(qstash.publish).toHaveBeenCalledTimes(1);
      expect(qstash.publish).toHaveBeenCalledWith('notify-approval-pending', {
        approvalId: 'approval-1',
        taskName: 'Review evidence',
        hours: 30,
      });
    });

    it("falls back to 'Unknown Task' when the task relation is null", async () => {
      prisma.approval.findMany.mockResolvedValue([
        { id: 'approval-2', entity_id: 'entity-999', created_at: created, task: null },
      ]);

      await cron.scanApprovalsPending();

      expect(qstash.publish).toHaveBeenCalledWith(
        'notify-approval-pending',
        expect.objectContaining({ approvalId: 'approval-2', taskName: 'Unknown Task', hours: 30 }),
      );
    });

    it('does not throw when prisma.approval.findMany fails', async () => {
      prisma.approval.findMany.mockRejectedValue(new Error('Connection lost'));

      await expect(cron.scanApprovalsPending()).resolves.toBeUndefined();
      expect(qstash.publish).not.toHaveBeenCalled();
    });

    it('does not throw when qstash.publish fails', async () => {
      prisma.approval.findMany.mockResolvedValue([
        { id: 'approval-1', entity_id: 'task-100', created_at: created, task: { id: 'task-100', title: 'Review evidence' } },
      ]);
      qstash.publish.mockRejectedValue(new Error('QStash down'));

      await expect(cron.scanApprovalsPending()).resolves.toBeUndefined();
    });
  });
});
