import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsDefined } from 'class-validator';
import { Prisma } from '@prisma/client';
import { SettingsService } from './settings.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

export class UpdateSettingDto {
  @IsDefined()
  value!: Prisma.InputJsonValue;
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':key')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async getSetting(@Param('key') key: string) {
    return this.settingsService.getSetting(key);
  }

  @Patch(':key')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async updateSetting(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingsService.updateSetting(key, dto.value);
  }
}
