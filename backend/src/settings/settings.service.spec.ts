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

      await expect(service.getSetting('nonexistent_key')).rejects.toThrow(
        NotFoundException,
      );
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

    it('creates setting if it does not exist (upsert creates new)', async () => {
      const newSetting = { key: 'new_feature_enabled', value: 'true', updated_at: new Date() };
      prisma.systemSetting.upsert.mockResolvedValue(newSetting);

      const result = await service.updateSetting('new_feature_enabled', 'true');

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { key: 'new_feature_enabled', value: 'true' },
        }),
      );
      expect(result).toEqual(newSetting);
    });
  });
});
