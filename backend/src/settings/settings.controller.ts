import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { SettingsService } from './settings.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

export class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  value: string;
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
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settingsService.updateSetting(key, dto.value);
  }
}
