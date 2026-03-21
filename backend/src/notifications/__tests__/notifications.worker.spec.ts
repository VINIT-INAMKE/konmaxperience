import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsWorker } from '../notifications.worker';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock mailersend module
jest.mock('mailersend', () => ({
  MailerSend: jest.fn().mockImplementation(() => ({
    email: { send: jest.fn().mockResolvedValue({}) },
  })),
  EmailParams: jest.fn().mockImplementation(() => {
    const self = {
      setFrom: jest.fn().mockReturnThis(),
      setTo: jest.fn().mockReturnThis(),
      setSubject: jest.fn().mockReturnThis(),
      setHtml: jest.fn().mockReturnThis(),
      setText: jest.fn().mockReturnThis(),
    };
    return self;
  }),
  Sender: jest.fn(),
  Recipient: jest.fn(),
}));

describe('NotificationsWorker', () => {
  let worker: NotificationsWorker;
  let notificationsService: {
    create: jest.Mock;
    shouldNotify: jest.Mock;
    getUsersByPermission: jest.Mock;
  };
  let prismaService: {
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    notification: { update: jest.Mock };
  };

  beforeEach(async () => {
    notificationsService = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1', title: 'Test', body: 'Test body' }),
      shouldNotify: jest.fn().mockResolvedValue(true),
      getUsersByPermission: jest.fn().mockResolvedValue([]),
    };

    prismaService = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
        }),
      },
      notification: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsWorker,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PrismaService, useValue: prismaService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                MAILERSEND_API_KEY: 'test-key',
                MAILERSEND_FROM_EMAIL: 'test@konma.com',
                FRONTEND_URL: 'http://localhost:3000',
              };
              return map[key] || '';
            }),
          },
        },
      ],
    }).compile();

    worker = module.get<NotificationsWorker>(NotificationsWorker);
  });

  describe('notify-new-order', () => {
    it('creates notifications for all MANAGE_KITCHEN users, does NOT send email', async () => {
      const kitchenUsers = [
        { id: 'k1', role: { permissions: ['MANAGE_KITCHEN'] } },
        { id: 'k2', role: { permissions: ['MANAGE_KITCHEN'] } },
      ];
      notificationsService.getUsersByPermission.mockResolvedValue(kitchenUsers);

      await worker.process({
        name: 'notify-new-order',
        data: {
          orderId: 'order-abc123def456',
          channel: 'dine_in',
          itemCount: 3,
        },
        id: 'job-1',
      } as any);

      expect(notificationsService.getUsersByPermission).toHaveBeenCalledWith(
        'MANAGE_KITCHEN',
      );
      expect(notificationsService.create).toHaveBeenCalledTimes(2);
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'k1',
          type: 'new_order',
          title: 'New order #DEF456',
          reference_type: 'order',
        }),
      );
      // No email should have been sent (no user.findUnique call for email)
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('notify-low-stock', () => {
    it('with shouldNotify=true creates notification and attempts email', async () => {
      const procurementUsers = [
        { id: 'p1', role: { permissions: ['MANAGE_PROCUREMENT'] } },
      ];
      notificationsService.getUsersByPermission.mockResolvedValue(
        procurementUsers,
      );
      notificationsService.shouldNotify.mockResolvedValue(true);

      await worker.process({
        name: 'notify-low-stock',
        data: {
          ingredientId: 'ing-1',
          ingredientName: 'Tomato',
          currentQty: 2,
          minQty: 10,
          unit: 'kg',
        },
        id: 'job-2',
      } as any);

      expect(notificationsService.shouldNotify).toHaveBeenCalledWith(
        'p1',
        'low_stock',
        'ing-1',
        4,
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'p1',
          type: 'low_stock',
          title: 'Low stock: Tomato',
          body: 'Tomato is at 2 kg, below minimum level of 10 kg.',
        }),
      );
      // Email was attempted (user.findUnique for email)
      expect(prismaService.user.findUnique).toHaveBeenCalled();
    });

    it('isolates email failure - notification still created', async () => {
      const procurementUsers = [
        { id: 'p1', role: { permissions: ['MANAGE_PROCUREMENT'] } },
      ];
      notificationsService.getUsersByPermission.mockResolvedValue(
        procurementUsers,
      );
      notificationsService.shouldNotify.mockResolvedValue(true);
      // Make user lookup return null to trigger email skip (effectively isolates failure)
      prismaService.user.findUnique.mockResolvedValue(null);

      await worker.process({
        name: 'notify-low-stock',
        data: {
          ingredientId: 'ing-2',
          ingredientName: 'Onion',
          currentQty: 1,
          minQty: 5,
          unit: 'kg',
        },
        id: 'job-3',
      } as any);

      // Notification was still created despite email not being sent
      expect(notificationsService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('notify-order-ready', () => {
    it('creates notifications for all MANAGE_POS users', async () => {
      const posUsers = [
        { id: 'pos1', role: { permissions: ['MANAGE_POS'] } },
      ];
      notificationsService.getUsersByPermission.mockResolvedValue(posUsers);

      await worker.process({
        name: 'notify-order-ready',
        data: {
          orderId: 'order-xyzxyzxyz123',
          channel: 'takeaway',
        },
        id: 'job-4',
      } as any);

      expect(notificationsService.getUsersByPermission).toHaveBeenCalledWith(
        'MANAGE_POS',
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'pos1',
          type: 'order_ready',
          body: 'takeaway order is ready for pickup.',
        }),
      );
    });
  });

  describe('notify-task-due', () => {
    it('with shouldNotify=false (cooldown active) does NOT create notification', async () => {
      notificationsService.shouldNotify.mockResolvedValue(false);

      await worker.process({
        name: 'notify-task-due',
        data: {
          userId: 'user-1',
          taskId: 'task-1',
          taskName: 'Test Task',
          questName: 'Test Quest',
          hours: 12,
        },
        id: 'job-5',
      } as any);

      expect(notificationsService.shouldNotify).toHaveBeenCalledWith(
        'user-1',
        'task_due',
        'task-1',
        24,
      );
      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('failure isolation', () => {
    it('when service.create throws, worker catches and logs (does not re-throw)', async () => {
      const kitchenUsers = [
        { id: 'k1', role: { permissions: ['MANAGE_KITCHEN'] } },
      ];
      notificationsService.getUsersByPermission.mockResolvedValue(kitchenUsers);
      notificationsService.create.mockRejectedValue(
        new Error('DB connection lost'),
      );

      // Should NOT throw
      await expect(
        worker.process({
          name: 'notify-new-order',
          data: {
            orderId: 'order-fail123456',
            channel: 'delivery',
            itemCount: 1,
          },
          id: 'job-6',
        } as any),
      ).resolves.toBeUndefined();
    });
  });
});
