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
import { PickAndPackController } from './pick-and-pack/pick-and-pack.controller';
import { PickAndPackService } from './pick-and-pack/pick-and-pack.service';
import { SupplyUsageController } from './supply-usage/supply-usage.controller';
import { SupplyUsageService } from './supply-usage/supply-usage.service';
import { FulfilmentModule } from '../fulfilment/fulfilment.module';

@Module({
  imports: [FulfilmentModule],
  controllers: [
    PrepBatchesController,
    KdsController,
    WasteController,
    KitchenMetricsController,
    PickAndPackController,
    SupplyUsageController,
  ],
  providers: [
    PrepBatchesService,
    KdsService,
    WasteService,
    KitchenMetricsService,
    KitchenExpiryCron,
    PickAndPackService,
    SupplyUsageService,
  ],
  exports: [PrepBatchesService, WasteService],
})
export class KitchenModule {}
