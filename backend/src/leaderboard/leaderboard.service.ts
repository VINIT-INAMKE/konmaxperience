import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async getLeaderboard() {
    // Run both queries in parallel — short-circuit if disabled
    const [enabled, users] = await Promise.all([
      this.settingsService.get('leaderboard_enabled'),
      this.prisma.user.findMany({
        where: {
          status: 'active',
          role: {
            code: {
              not: 'FOUNDER_ADMIN',
            },
          },
        },
        select: {
          id: true,
          name: true,
          xp_total: true,
          level: true,
          function: true,
        },
        orderBy: { xp_total: 'desc' },
      }),
    ]);

    if (!enabled) {
      return { enabled: false, users: [] };
    }

    return { enabled: true, users };
  }
}
