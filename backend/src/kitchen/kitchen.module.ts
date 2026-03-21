import { Module } from '@nestjs/common';
import { PrepBatchesController } from './prep-batches/prep-batches.controller';
import { PrepBatchesService } from './prep-batches/prep-batches.service';
import { KdsController } from './kds/kds.controller';
import { KdsService } from './kds/kds.service';
import { WasteController } from './waste/waste.controller';
import { WasteService } from './waste/waste.service';
import { KitchenMetricsController } from './metrics/kitchen-metrics.controller';
import { KitchenMetricsService } from './metrics/kitchen-metrics.service';
import { KitchenExpiryCron } from './expiry/kitchen-expiry.cron';

@Module({
  controllers: [
    PrepBatchesController,
    KdsController,
    WasteController,
    KitchenMetricsController,
  ],
  providers: [
    PrepBatchesService,
    KdsService,
    WasteService,
    KitchenMetricsService,
    KitchenExpiryCron,
  ],
  exports: [PrepBatchesService],
})
export class KitchenModule {}
