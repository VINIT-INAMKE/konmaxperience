import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;

  const mockSetting = {
    key: 'leaderboard_enabled',
    value: 'true',
    updated_at: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      systemSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  describe('getSetting', () => {
    it('returns the setting for a given key', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(mockSetting);

      const result = await service.getSetting('leaderboard_enabled');

      expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'leaderboard_enabled' },
      });
      expect(result).toEqual(mockSetting);
    });

    it('throws NotFoundException when setting does not exist', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);

      await expect(service.getSetting('system_name')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSetting', () => {
    it('upserts the value for a given key', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({
        ...mockSetting,
        value: 'false',
      });

      const result = await service.updateSetting('leaderboard_enabled', 'false');

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'leaderboard_enabled' },
        update: { value: 'false' },
        create: { key: 'leaderboard_enabled', value: 'false' },
      });
      expect(result.value).toBe('false');
    });

    it('accepts marketplace_fulfilment_zone_id and upserts it', async () => {
      const newSetting = { key: 'marketplace_fulfilment_zone_id', value: 'zone-1', updated_at: new Date() };
      prisma.systemSetting.upsert.mockResolvedValue(newSetting);

      const result = await service.updateSetting('marketplace_fulfilment_zone_id', 'zone-1');

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { key: 'marketplace_fulfilment_zone_id', value: 'zone-1' },
        }),
      );
      expect(result).toEqual(newSetting);
    });
  });
});
