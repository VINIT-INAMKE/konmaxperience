import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  SETTING_DEFAULTS,
  SETTING_KEYS,
  SettingsService,
} from './settings.service';
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

    it('serves the P5a commerce blocks from their declared defaults', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);
      await expect(service.get('loyalty')).resolves.toEqual({
        earn_rate_per_100: 5,
        redeem_value_per_point: 0.25,
        expiry_days: 365,
        max_redeem_percent: 20,
        tiers: { member: 0, regular: 500, insider: 2000 },
      });
      await expect(service.get('reviews')).resolves.toEqual({
        auto_publish_min_rating: 4,
        invitation_delay_hours: 24,
      });
      await expect(service.get('promotions')).resolves.toEqual({
        allow_stacking: false,
      });
      await expect(service.get('shipping')).resolves.toMatchObject({
        provider: 'manual',
      });
    });

    it('returns the stored override for a commerce block, not the default', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'promotions',
        value: { allow_stacking: true },
        updated_at: new Date(),
      });
      await expect(service.get('promotions')).resolves.toEqual({
        allow_stacking: true,
      });
    });

    it('backfills a block row written before a key existed', async () => {
      // The `loyalty` row seeded before P5a has neither `expiry_days` nor
      // `max_redeem_percent`, and the reference seed never rewrites it.
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'loyalty',
        value: {
          earn_rate_per_100: 8,
          redeem_value_per_point: 0.25,
          tiers: { member: 0, regular: 500, insider: 2000 },
        },
        updated_at: new Date(),
      });
      const loyalty = await service.get('loyalty');
      expect(loyalty.earn_rate_per_100).toBe(8); // the operator's edit wins
      expect(loyalty.expiry_days).toBe(365); // the new key is filled in
      expect(loyalty.max_redeem_percent).toBe(20);
    });

    it('does not merge a stored array or scalar into its default', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'delivery_pincodes',
        value: ['560001', '560002'],
        updated_at: new Date(),
      });
      await expect(service.get('delivery_pincodes')).resolves.toEqual([
        '560001',
        '560002',
      ]);

      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'leaderboard_enabled',
        value: false,
        updated_at: new Date(),
      });
      await expect(service.get('leaderboard_enabled')).resolves.toBe(false);
    });
  });

  describe('allow-list', () => {
    it('carries every key the P5a commerce path reads', () => {
      for (const key of [
        'shipping',
        'loyalty',
        'reviews',
        'promotions',
        'delivery_pincodes',
      ]) {
        expect(SETTING_KEYS).toContain(key);
      }
    });

    it('names every key exactly once, in SETTING_DEFAULTS order', () => {
      expect(SETTING_KEYS).toEqual(Object.keys(SETTING_DEFAULTS));
      expect(new Set(SETTING_KEYS).size).toBe(SETTING_KEYS.length);
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
