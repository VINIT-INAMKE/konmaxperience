import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NodeService } from './node.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from './node.constants';

const node = {
  id: DEFAULT_NODE_ID,
  code: 'KX-VILLA-1',
  name: 'Konma Xperience Villa 1',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
};

describe('NodeService', () => {
  let service: NodeService;
  let prisma: {
    node: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      node: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [NodeService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(NodeService);
  });

  it('returns the default node and caches it', async () => {
    prisma.node.findUnique.mockResolvedValue(node);
    expect(await service.currentId()).toBe(DEFAULT_NODE_ID);
    expect(await service.timezone()).toBe('Asia/Kolkata');
    expect(prisma.node.findUnique).toHaveBeenCalledTimes(1);
  });

  it('falls back to the oldest node when the default id is absent', async () => {
    prisma.node.findUnique.mockResolvedValue(null);
    prisma.node.findFirst.mockResolvedValue({ ...node, id: 'other' });
    expect(await service.currentId()).toBe('other');
  });

  it('throws when no node is seeded', async () => {
    prisma.node.findUnique.mockResolvedValue(null);
    prisma.node.findFirst.mockResolvedValue(null);
    await expect(service.current()).rejects.toThrow(NotFoundException);
  });

  it('update refreshes the cache', async () => {
    prisma.node.findUnique.mockResolvedValue(node);
    prisma.node.update.mockResolvedValue({ ...node, timezone: 'Asia/Dubai' });
    await service.update({ timezone: 'Asia/Dubai' });
    expect(await service.timezone()).toBe('Asia/Dubai');
  });
});
