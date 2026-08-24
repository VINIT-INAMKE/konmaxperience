import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { OrphanSweepCron } from './orphan-sweep.cron';
import { SettingsModule } from '../settings/settings.module';

/**
 * `SettingsModule` is imported for one reason: the weekly orphan sweep reads
 * `SystemSetting['maintenance_mode']` as its dry-run switch. `SettingsModule`
 * imports nothing but its own controller and service, so there is no cycle.
 */
@Module({
  imports: [SettingsModule],
  controllers: [StorageController],
  providers: [StorageService, OrphanSweepCron],
  exports: [StorageService],
})
export class StorageModule {}
