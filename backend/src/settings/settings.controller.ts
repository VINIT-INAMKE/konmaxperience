import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':key')
  async getSetting(@Param('key') key: string) {
    return this.settingsService.getSetting(key);
  }

  @Patch(':key')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: string },
  ) {
    return this.settingsService.updateSetting(key, body.value);
  }
}
