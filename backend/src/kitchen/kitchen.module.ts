import { Module } from '@nestjs/common';
import { PrepBatchesController } from './prep-batches/prep-batches.controller';
import { PrepBatchesService } from './prep-batches/prep-batches.service';
import { KdsController } from './kds/kds.controller';
import { KdsService } from './kds/kds.service';
import { WasteController } from './waste/waste.controller';
import { WasteService } from './waste/waste.service';

@Module({
  controllers: [PrepBatchesController, KdsController, WasteController],
  providers: [PrepBatchesService, KdsService, WasteService],
  exports: [PrepBatchesService],
})
export class KitchenModule {}
