import { Module } from '@nestjs/common';
import { PrepBatchesController } from './prep-batches/prep-batches.controller';
import { PrepBatchesService } from './prep-batches/prep-batches.service';

@Module({
  controllers: [PrepBatchesController],
  providers: [PrepBatchesService],
  exports: [PrepBatchesService],
})
export class KitchenModule {}
