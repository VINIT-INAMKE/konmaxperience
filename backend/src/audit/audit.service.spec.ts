import { Test } from '@nestjs/testing';
import { ActorType, Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditEvent: { create: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      auditEvent: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  it('writes through the transaction client, not this.prisma', async () => {
    const tx = { auditEvent: { create: jest.fn() } };
    await service.record(tx as never, {
      entity_type: 'task',
      entity_id: 't-1',
      action: 'task.status_changed',
      ...AuditService.user('u-1'),
      before: { status: 'todo' },
      after: { status: 'done' },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        node_id: DEFAULT_NODE_ID,
        entity_type: 'task',
        entity_id: 't-1',
        action: 'task.status_changed',
        actor_type: ActorType.user,
        actor_id: 'u-1',
        before: { status: 'todo' },
        after: { status: 'done' },
      }),
    });
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('honours an explicit node_id override', async () => {
    const tx = { auditEvent: { create: jest.fn() } };
    await service.record(tx as never, {
      entity_type: 'order',
      entity_id: 'o-9',
      action: 'order.created',
      node_id: 'node-2',
      ...AuditService.user('u-1'),
    });
    expect(tx.auditEvent.create.mock.calls[0][0].data.node_id).toBe('node-2');
  });

  it('missing before/after become Prisma.JsonNull and actor_id null', async () => {
    const tx = { auditEvent: { create: jest.fn() } };
    await service.record(tx as never, {
      entity_type: 'order',
      entity_id: 'o-1',
      action: 'order.created',
      ...AuditService.user(null),
    });
    const data = tx.auditEvent.create.mock.calls[0][0].data;
    expect(data.before).toBe(Prisma.JsonNull);
    expect(data.after).toBe(Prisma.JsonNull);
    expect(data.actor_type).toBe(ActorType.system);
    expect(data.actor_id).toBeNull();
  });

  it('customer actor tuple', () => {
    expect(AuditService.customer('c-1')).toEqual({
      actor_type: ActorType.customer,
      actor_id: 'c-1',
    });
  });

  it('list caps limit at 200 and applies the entity filter', async () => {
    await service.list('task', 't-1', 5000);
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 200,
        where: { entity_type: 'task', entity_id: 't-1' },
        orderBy: { created_at: 'desc' },
      }),
    );
  });

  it('list without filters omits the where keys and defaults to 50', async () => {
    await service.list();
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, where: {} }),
    );
    expect(prisma.auditEvent.findMany.mock.calls[0][0].cursor).toBeUndefined();
  });

  it('list paginates past the cursor row', async () => {
    await service.list(undefined, undefined, 10, 'ev-5');
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: 'ev-5' } }),
    );
  });
});
