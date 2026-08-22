import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  private readonly ALLOWED_KEYS = [
    'leaderboard_enabled',
    'system_name',
    'maintenance_mode',
    'marketplace_fulfilment_zone_id',
  ];

  constructor(private readonly prisma: PrismaService) {}

  private validateKey(key: string) {
    if (!this.ALLOWED_KEYS.includes(key)) {
      throw new BadRequestException(
        `Invalid setting key: ${key}. Allowed: ${this.ALLOWED_KEYS.join(', ')}`,
      );
    }
  }

  async getSetting(key: string) {
    this.validateKey(key);

    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    return setting;
  }

  async updateSetting(key: string, value: string) {
    this.validateKey(key);

    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
