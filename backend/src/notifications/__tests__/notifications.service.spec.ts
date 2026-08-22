import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('create', () => {
    it('creates a notification record with correct fields', async () => {
      const data = {
        user_id: 'user-1',
        type: NotificationType.task_due,
        title: 'Task due',
        body: 'Your task is due soon',
        link_url: '/tasks/123',
        reference_id: 'task-123',
        reference_type: 'task',
      };
      prisma.notification.create.mockResolvedValue({ id: 'notif-1', ...data });

      const result = await service.create(data);

      expect(prisma.notification.create).toHaveBeenCalledWith({ data });
      expect(result.id).toBe('notif-1');
      expect(result.type).toBe('task_due');
    });
  });

  describe('shouldNotify', () => {
    it('returns true when no prior notification exists', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      const result = await service.shouldNotify(
        'user-1',
        'task_due',
        'task-123',
        24,
      );

      expect(result).toBe(true);
      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: {
          user_id: 'user-1',
          type: 'task_due',
          reference_id: 'task-123',
        },
        orderBy: { created_at: 'desc' },
      });
    });

    it('returns false when notification sent less than cooldown hours ago', async () => {
      const recentTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      prisma.notification.findFirst.mockResolvedValue({
        created_at: recentTime,
      });

      const result = await service.shouldNotify(
        'user-1',
        'task_due',
        'task-123',
        24,
      );

      expect(result).toBe(false);
    });

    it('returns true when notification sent more than cooldown hours ago', async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      prisma.notification.findFirst.mockResolvedValue({
        created_at: oldTime,
      });

      const result = await service.shouldNotify(
        'user-1',
        'task_due',
        'task-123',
        24,
      );

      expect(result).toBe(true);
    });
  });

  describe('unreadCount', () => {
    it('returns { count: N } matching unread notifications for user', async () => {
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.unreadCount('user-1');

      expect(result).toEqual({ count: 5 });
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { user_id: 'user-1', is_read: false },
      });
    });
  });

  describe('markAllRead', () => {
    it('updates all unread notifications to is_read=true', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      await service.markAllRead('user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { user_id: 'user-1', is_read: false },
        data: { is_read: true },
      });
    });
  });

  describe('getUsersByPermission', () => {
    it('queries active users whose role has the permission and returns ids', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);

      const result = await service.getUsersByPermission('MANAGE_KITCHEN');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { status: 'active', role: { permissions: { has: 'MANAGE_KITCHEN' } } },
        select: { id: true },
      });
      expect(result).toEqual([{ id: 'u1' }]);
    });
  });
});
