import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let prisma: any;
  let settings: { get: jest.Mock };

  const mockUsers = [
    {
      id: 'user-1',
      name: 'Alice',
      xp_total: 500,
      level: 3,
      function: 'backend',
    },
    {
      id: 'user-2',
      name: 'Bob',
      xp_total: 200,
      level: 2,
      function: 'frontend',
    },
  ];

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
      },
    };
    settings = { get: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  describe('getLeaderboard', () => {
    it('returns users ordered by xp_total descending excluding FOUNDER_ADMIN', async () => {
      settings.get.mockResolvedValue(true);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getLeaderboard();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: expect.objectContaining({
              code: expect.objectContaining({
                not: 'FOUNDER_ADMIN',
              }),
            }),
          }),
          orderBy: { xp_total: 'desc' },
        }),
      );
      expect(result).toEqual({ enabled: true, users: mockUsers });
    });

    it('returns empty array and enabled=false when leaderboard_enabled is false', async () => {
      settings.get.mockResolvedValue(false);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getLeaderboard();

      expect(result).toEqual({ enabled: false, users: [] });
    });

    it('returns leaderboard when the setting row is absent (service default on)', async () => {
      settings.get.mockResolvedValue(true);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getLeaderboard();

      expect(result.enabled).toBe(true);
      expect(result.users).toEqual(mockUsers);
    });

    it('reads the leaderboard_enabled setting through the typed getter', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.getLeaderboard();

      expect(settings.get).toHaveBeenCalledWith('leaderboard_enabled');
    });
  });
});
