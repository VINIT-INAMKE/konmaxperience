import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { UsageEventType } from '@prisma/client';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrisma, MockPrisma } from '../test-utils/mock-providers';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

describe('UsageService', () => {
  let service: UsageService;
  let prisma: MockPrisma;

  const actor = { id: 'user-1', roleCode: 'BACKEND_LEAD' };

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsageService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsageService>(UsageService);
    jest.clearAllMocks();
  });

  describe('record', () => {
    it('writes path and nulls action for a page_view', async () => {
      prisma.usageEvent.create.mockResolvedValue({ id: 'ev-1' });

      await service.record(
        {
          event_type: UsageEventType.page_view,
          path: '/tasks',
          action: 'task.create',
        },
        actor,
      );

      expect(prisma.usageEvent.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-1',
          role_code: 'BACKEND_LEAD',
          event_type: UsageEventType.page_view,
          path: '/tasks',
          action: null,
          meta: undefined,
        },
      });
    });

    it('writes action and nulls path for an action event', async () => {
      prisma.usageEvent.create.mockResolvedValue({ id: 'ev-2' });

      await service.record(
        {
          event_type: UsageEventType.action,
          path: '/tasks',
          action: 'task.create',
          meta: { task_id: 't-1' },
        },
        actor,
      );

      expect(prisma.usageEvent.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-1',
          role_code: 'BACKEND_LEAD',
          event_type: UsageEventType.action,
          path: null,
          action: 'task.create',
          meta: { task_id: 't-1' },
        },
      });
    });

    it('resolves without throwing when the write rejects', async () => {
      prisma.usageEvent.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.record(
          { event_type: UsageEventType.page_view, path: '/tasks' },
          actor,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('summary', () => {
    it('filters from `days` back and caps each bucket at 25', async () => {
      prisma.usageEvent.groupBy.mockResolvedValue([]);
      const before = Date.now();

      const result = await service.summary(7);

      expect(prisma.usageEvent.groupBy).toHaveBeenCalledTimes(3);
      const [roleArgs, pathArgs, actionArgs] =
        prisma.usageEvent.groupBy.mock.calls.map(
          (call: unknown[]) => call[0] as any,
        );

      const since = roleArgs.where.created_at.gte as Date;
      const expected = before - 7 * 86_400_000;
      expect(Math.abs(since.getTime() - expected)).toBeLessThan(5_000);

      expect(roleArgs.by).toEqual(['role_code']);
      expect(pathArgs.take).toBe(25);
      expect(pathArgs.where.event_type).toBe(UsageEventType.page_view);
      expect(actionArgs.take).toBe(25);
      expect(actionArgs.where.event_type).toBe(UsageEventType.action);
      expect(result).toEqual({
        days: 7,
        by_role: [],
        by_path: [],
        by_action: [],
      });
    });
  });
});

describe('UsageController permissions', () => {
  it('leaves the ingest endpoint open to every authenticated staff role', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        UsageController.prototype.record,
      ),
    ).toBeUndefined();
  });

  it('requires MANAGE_SYSTEM for the summary roll-up', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        UsageController.prototype.summary,
      ),
    ).toBe(Permission.MANAGE_SYSTEM);
  });
});
