import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { MeService } from './me.service';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { ModuleAccessService } from '../module-access/module-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprovalsService } from '../approvals/approvals.service';
import {
  mockPrisma,
  MockPrisma,
  mockNodeService,
} from '../test-utils/mock-providers';
import { Permission } from '../types/permissions';

describe('MeService', () => {
  let service: MeService;
  let prisma: MockPrisma;
  let moduleAccess: { forRole: jest.Mock };
  let notifications: { unreadCount: jest.Mock };
  let approvals: { countForUser: jest.Mock };

  const actor = {
    id: 'user-1',
    roleCode: 'BACKEND_LEAD',
    permissions: [Permission.VIEW_ROLE_SCOPED as string],
  };

  const activeMission = {
    id: 'm-1',
    title: 'Open the villa kitchen',
    phase: 'activation',
    status: 'active',
  };

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Backend Lead',
      email: 'backend@konma.io',
      xp_total: 420,
      level: 3,
      streak_days: 5,
      role: { code: 'BACKEND_LEAD', name: 'Backend Lead' },
    });
    prisma.mission.findFirst.mockResolvedValue(activeMission);
    prisma.quest.findFirst.mockResolvedValue(null);
    prisma.readinessMeter.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(2);

    moduleAccess = { forRole: jest.fn().mockResolvedValue(['my_tasks']) };
    notifications = { unreadCount: jest.fn().mockResolvedValue({ count: 7 }) };
    approvals = { countForUser: jest.fn().mockResolvedValue({ count: 3 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        { provide: PrismaService, useValue: prisma },
        { provide: NodeService, useValue: mockNodeService() },
        { provide: ModuleAccessService, useValue: moduleAccess },
        { provide: NotificationsService, useValue: notifications },
        { provide: ApprovalsService, useValue: approvals },
      ],
    }).compile();

    service = module.get<MeService>(MeService);
  });

  it('returns the newest active mission', async () => {
    const result = await service.header(actor);

    expect(prisma.mission.findFirst).toHaveBeenCalledWith({
      where: { status: 'active' },
      orderBy: { created_at: 'desc' },
      select: { id: true, title: true, phase: true, status: true },
    });
    expect(result.mission).toEqual(activeMission);
  });

  it("prefers the caller's in-window quest and marks it mine", async () => {
    prisma.quest.findFirst.mockResolvedValueOnce({
      id: 'q-1',
      title: 'Week 4 — plating',
      week_number: 4,
      progress_percent: 60,
    });

    const result = await service.header(actor);

    expect(result.quest).toEqual({
      id: 'q-1',
      title: 'Week 4 — plating',
      week_number: 4,
      progress_percent: 60,
      mine: true,
    });
    // Only the "mine" lookup ran — no fallback query.
    expect(prisma.quest.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.quest.findFirst.mock.calls[0][0].where).toMatchObject({
      owner_user_id: 'user-1',
    });
  });

  it('falls back to the node quest with mine: false', async () => {
    prisma.quest.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'q-node',
      title: 'Week 4 — villa',
      week_number: 4,
      progress_percent: 25,
    });

    const result = await service.header(actor);

    expect(prisma.quest.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.quest.findFirst.mock.calls[1][0].where).not.toHaveProperty(
      'owner_user_id',
    );
    expect(result.quest).toEqual({
      id: 'q-node',
      title: 'Week 4 — villa',
      week_number: 4,
      progress_percent: 25,
      mine: false,
    });
  });

  it('reports readiness_percent as null when there are no meters', async () => {
    const result = await service.header(actor);

    expect(result.readiness_percent).toBeNull();
  });

  it('averages meter current_value into a rounded readiness_percent', async () => {
    prisma.readinessMeter.findMany.mockResolvedValue([
      { current_value: 80 },
      { current_value: 55 },
      { current_value: 40 },
    ]);

    const result = await service.header(actor);

    expect(result.readiness_percent).toBe(58);
  });

  it('reflects the permission list in can_create_mission', async () => {
    await expect(service.header(actor)).resolves.toMatchObject({
      can_create_mission: false,
    });

    await expect(
      service.header({ ...actor, permissions: [Permission.CREATE_MISSION] }),
    ).resolves.toMatchObject({ can_create_mission: true });
  });

  it('aggregates the badge counts from their owning services', async () => {
    const result = await service.header(actor);

    expect(approvals.countForUser).toHaveBeenCalledWith({
      id: 'user-1',
      roleCode: 'BACKEND_LEAD',
    });
    expect(notifications.unreadCount).toHaveBeenCalledWith('user-1');
    expect(moduleAccess.forRole).toHaveBeenCalledWith('BACKEND_LEAD');
    expect(result).toMatchObject({
      approvals_waiting: 3,
      notifications_unread: 7,
      my_blockers: 2,
      module_keys: ['my_tasks'],
      xp_total: 420,
      level: 3,
      role: { code: 'BACKEND_LEAD', name: 'Backend Lead' },
    });
    expect(result.node).toMatchObject({ code: 'KX-VILLA-1' });
  });

  it('never throws when the user row is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.header(actor);

    expect(result.user).toBeNull();
    expect(result.role).toBeNull();
    expect(result.xp_total).toBe(0);
    expect(result.level).toBe(1);
  });
});
