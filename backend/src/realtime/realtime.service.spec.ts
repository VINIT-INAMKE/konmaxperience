import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { RealtimeListener } from './realtime.listener';
import { PusherService } from '../chat/pusher.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPusher } from '../test-utils/mock-providers';
import { Permission } from '../types/permissions';
import { REALTIME_EVENTS } from './realtime.channels';

jest.mock('../permissions/permissions.cache', () => ({
  getPermissionsForRole: jest.fn(),
}));
import { getPermissionsForRole } from '../permissions/permissions.cache';
const mockGetPermissions = getPermissionsForRole as jest.MockedFunction<
  typeof getPermissionsForRole
>;

describe('RealtimeService', () => {
  let service: RealtimeService;
  let prisma: { moduleAccess: { findUnique: jest.Mock } };
  let pusher: ReturnType<typeof mockPusher>;

  const kitchenActor = { id: 'user-1', roleCode: 'BACKEND_LEAD' };
  const AUTH_PAYLOAD = { auth: 'key:signature' };

  beforeEach(async () => {
    prisma = { moduleAccess: { findUnique: jest.fn() } };
    pusher = mockPusher();
    pusher.authorizeChannel.mockReturnValue(AUTH_PAYLOAD);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeService,
        { provide: PrismaService, useValue: prisma },
        { provide: PusherService, useValue: pusher },
      ],
    }).compile();

    service = module.get<RealtimeService>(RealtimeService);

    mockGetPermissions.mockResolvedValue([Permission.MANAGE_KITCHEN]);
    prisma.moduleAccess.findUnique.mockResolvedValue({
      enabled: true,
      role_codes: ['BACKEND_LEAD'],
    });
  });

  describe('authorize — per-user channels', () => {
    it('authorises the caller for their own channel', async () => {
      await expect(
        service.authorize('sock-1', 'private-user-user-1', kitchenActor),
      ).resolves.toEqual(AUTH_PAYLOAD);
      expect(pusher.authorizeChannel).toHaveBeenCalledWith(
        'sock-1',
        'private-user-user-1',
      );
    });

    it("refuses another user's channel", async () => {
      await expect(
        service.authorize('sock-1', 'private-user-user-9', kitchenActor),
      ).rejects.toThrow(ForbiddenException);
      expect(pusher.authorizeChannel).not.toHaveBeenCalled();
    });
  });

  describe('authorize — static channels', () => {
    it('refuses a channel outside the closed vocabulary', async () => {
      await expect(
        service.authorize('sock-1', 'private-anything', kitchenActor),
      ).rejects.toThrow(ForbiddenException);
      expect(pusher.authorizeChannel).not.toHaveBeenCalled();
    });

    it('authorises a permitted role whose module is enabled', async () => {
      await expect(
        service.authorize('sock-1', 'private-kds', kitchenActor),
      ).resolves.toEqual(AUTH_PAYLOAD);
      expect(prisma.moduleAccess.findUnique).toHaveBeenCalledWith({
        where: { module_key: 'kds' },
        select: { enabled: true, role_codes: true },
      });
    });

    it('refuses a role that lacks the channel permission', async () => {
      mockGetPermissions.mockResolvedValue([Permission.VIEW_ROLE_SCOPED]);

      await expect(
        service.authorize('sock-1', 'private-kds', kitchenActor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.moduleAccess.findUnique).not.toHaveBeenCalled();
    });

    it('refuses when the module is disabled', async () => {
      prisma.moduleAccess.findUnique.mockResolvedValue({
        enabled: false,
        role_codes: ['BACKEND_LEAD'],
      });

      await expect(
        service.authorize('sock-1', 'private-kds', kitchenActor),
      ).rejects.toThrow(ForbiddenException);
      expect(pusher.authorizeChannel).not.toHaveBeenCalled();
    });

    it('refuses a role that holds the permission but is not in role_codes', async () => {
      prisma.moduleAccess.findUnique.mockResolvedValue({
        enabled: true,
        role_codes: ['TECH_LEAD'],
      });

      await expect(
        service.authorize('sock-1', 'private-kds', kitchenActor),
      ).rejects.toThrow(ForbiddenException);
      expect(pusher.authorizeChannel).not.toHaveBeenCalled();
    });

    it('refuses when the module row does not exist', async () => {
      prisma.moduleAccess.findUnique.mockResolvedValue(null);

      await expect(
        service.authorize('sock-1', 'private-approvals', kitchenActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('emit', () => {
    it('passes the channel, event and payload through to Pusher', async () => {
      await service.emit('private-kds', 'kds.order.new', { order_id: 'o-1' });

      expect(pusher.trigger).toHaveBeenCalledWith(
        'private-kds',
        'kds.order.new',
        { order_id: 'o-1' },
      );
    });

    it('resolves when the Pusher trigger rejects', async () => {
      pusher.trigger.mockRejectedValue(new Error('pusher not configured'));

      await expect(
        service.emit('private-kds', 'kds.order.new', {}),
      ).resolves.toBeUndefined();
    });
  });
});

describe('RealtimeListener', () => {
  const realtime = { emit: jest.fn().mockResolvedValue(undefined) };
  const listener = new RealtimeListener(realtime as any);

  beforeEach(() => realtime.emit.mockClear());

  it('fans a placed order out to both kitchen boards', () => {
    listener.handleOrderPlaced({ orderId: 'o-1' } as any);

    expect(realtime.emit).toHaveBeenCalledWith(
      'private-kds',
      REALTIME_EVENTS.KDS_ORDER_NEW,
      { order_id: 'o-1' },
    );
    expect(realtime.emit).toHaveBeenCalledWith(
      'private-pick-pack',
      REALTIME_EVENTS.PICK_PACK_ORDER_NEW,
      { order_id: 'o-1' },
    );
  });

  it('pushes a countless approvals ping so the client refetches', () => {
    listener.handleApprovalDecided({
      occurred_at: '2026-08-23T00:00:00.000Z',
    } as any);

    expect(realtime.emit).toHaveBeenCalledWith(
      'private-approvals',
      REALTIME_EVENTS.APPROVALS_COUNT_CHANGED,
      { at: '2026-08-23T00:00:00.000Z' },
    );
  });
});
