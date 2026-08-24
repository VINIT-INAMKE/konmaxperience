import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockReconciliationCron } from './stock-reconciliation.cron';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, StockReconciliationCron],
  exports: [InventoryService],
})
export class InventoryModule {}
