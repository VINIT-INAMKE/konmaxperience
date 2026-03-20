import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let prisma: any;

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
      systemSetting: {
        findUnique: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
    jest.clearAllMocks();
  });

  describe('getLeaderboard', () => {
    it('returns users ordered by xp_total descending excluding FOUNDER_ADMIN', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'leaderboard_enabled',
        value: 'true',
      });
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
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'leaderboard_enabled',
        value: 'false',
      });

      const result = await service.getLeaderboard();

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({ enabled: false, users: [] });
    });

    it('returns leaderboard when leaderboard_enabled setting does not exist (default on)', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getLeaderboard();

      expect(result.enabled).toBe(true);
      expect(result.users).toEqual(mockUsers);
    });

    it('checks the leaderboard_enabled system setting key', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([]);

      await service.getLeaderboard();

      expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'leaderboard_enabled' },
      });
    });
  });
});
