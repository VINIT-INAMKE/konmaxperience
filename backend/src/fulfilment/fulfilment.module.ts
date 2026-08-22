import { Module } from '@nestjs/common';
import { FulfilmentService } from './fulfilment.service';

@Module({
  providers: [FulfilmentService],
  exports: [FulfilmentService],
})
export class FulfilmentModule {}
