import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;

  const mockSetting = {
    key: 'leaderboard_enabled',
    value: true,
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

  describe('get', () => {
    it('get returns the declared default when the row is absent', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);
      await expect(service.get('leaderboard_enabled')).resolves.toBe(true);
      await expect(service.get('delivery_pincodes')).resolves.toEqual([]);
    });

    it('get returns the declared default when the stored value is null', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'marketplace_fulfilment_zone_id',
        value: null,
        updated_at: new Date(),
      });
      await expect(
        service.get('marketplace_fulfilment_zone_id'),
      ).resolves.toBeNull();
    });

    it('get returns the stored JSON object', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'xp_rules',
        value: { core: 1, adhoc: 0.5, improvement: 0.9, level_curve: [0, 10] },
        updated_at: new Date(),
      });
      await expect(service.get('xp_rules')).resolves.toMatchObject({
        adhoc: 0.5,
      });
    });

    it('rejects an unknown key', async () => {
      await expect(service.get('nope' as never)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.systemSetting.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getSetting', () => {
    it('returns the setting row for a given key', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(mockSetting);

      const result = await service.getSetting('leaderboard_enabled');

      expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'leaderboard_enabled' },
      });
      expect(result).toEqual(mockSetting);
    });

    it('throws NotFoundException when setting does not exist', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);

      await expect(service.getSetting('system_name')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for a key outside the allow-list', async () => {
      await expect(service.getSetting('nope')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateSetting', () => {
    it('updateSetting upserts a JSON value', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({
        key: 'shipping',
        value: {},
      });
      await service.updateSetting('shipping', { provider: 'shiprocket' });
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { key: 'shipping', value: { provider: 'shiprocket' } },
        }),
      );
    });

    it('upserts a scalar value for a given key', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({
        ...mockSetting,
        value: false,
      });

      const result = await service.updateSetting('leaderboard_enabled', false);

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'leaderboard_enabled' },
        update: { value: false },
        create: { key: 'leaderboard_enabled', value: false },
      });
      expect(result.value).toBe(false);
    });

    it('accepts marketplace_fulfilment_zone_id and upserts it', async () => {
      const newSetting = {
        key: 'marketplace_fulfilment_zone_id',
        value: 'zone-1',
        updated_at: new Date(),
      };
      prisma.systemSetting.upsert.mockResolvedValue(newSetting);

      const result = await service.updateSetting(
        'marketplace_fulfilment_zone_id',
        'zone-1',
      );

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { key: 'marketplace_fulfilment_zone_id', value: 'zone-1' },
        }),
      );
      expect(result).toEqual(newSetting);
    });

    it('rejects an unknown key', async () => {
      await expect(service.updateSetting('nope', 'x')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.systemSetting.upsert).not.toHaveBeenCalled();
    });
  });
});
