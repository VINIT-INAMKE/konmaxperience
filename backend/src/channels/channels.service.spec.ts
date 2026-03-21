import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  channel: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('ChannelsService', () => {
  let service: ChannelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all channels', async () => {
      const channels = [
        { id: '1', name: 'Dine-in', channel_type: 'dine_in', status: 'planned' },
        { id: '2', name: 'Delivery', channel_type: 'delivery', status: 'active' },
      ];
      mockPrisma.channel.findMany.mockResolvedValue(channels);

      const result = await service.findAll();

      expect(mockPrisma.channel.findMany).toHaveBeenCalled();
      expect(result).toEqual(channels);
    });
  });

  describe('update', () => {
    it('updates channel status', async () => {
      const channel = { id: '1', name: 'Dine-in', channel_type: 'dine_in', status: 'planned' };
      mockPrisma.channel.findUnique.mockResolvedValue(channel);
      mockPrisma.channel.update.mockResolvedValue({ ...channel, status: 'active' });

      const result = await service.update('1', { status: 'active' });

      expect(mockPrisma.channel.update).toHaveBeenCalled();
      expect(result.status).toBe('active');
    });

    it('throws NotFoundException for non-existent channel', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { status: 'active' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
