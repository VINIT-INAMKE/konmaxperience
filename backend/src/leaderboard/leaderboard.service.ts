import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'leaderboard_enabled' },
    });

    if (setting?.value === 'false') {
      return { enabled: false, users: [] };
    }

    const users = await this.prisma.user.findMany({
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
    });

    return { enabled: true, users };
  }
}
