import { Module, OnModuleInit } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { StorageModule } from '../storage/storage.module';
import { OrdersModule } from '../orders/orders.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TasksModule } from '../tasks/tasks.module';
import { KpisModule } from '../kpis/kpis.module';
import { MenuModule } from '../menu/menu.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { KitchenModule } from '../kitchen/kitchen.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { OrdersExportBuilder } from './builders/orders.builder';
import {
  InventoryLevelsExportBuilder,
  StockMovementsExportBuilder,
} from './builders/inventory.builder';
import {
  TasksExportBuilder,
  KpisExportBuilder,
} from './builders/operations.builder';
import {
  MenuItemsExportBuilder,
  FeedbackExportBuilder,
} from './builders/menu.builder';
import {
  WasteLogExportBuilder,
  PrepBatchesExportBuilder,
} from './builders/kitchen.builder';
import {
  PurchaseOrdersExportBuilder,
  VendorPricingExportBuilder,
} from './builders/purchase-orders.builder';

@Module({
  imports: [
    StorageModule,
    OrdersModule,
    InventoryModule,
    TasksModule,
    KpisModule,
    MenuModule,
    FeedbackModule,
    KitchenModule,
    PurchaseOrdersModule,
  ],
  controllers: [ExportsController],
  providers: [
    ExportsService,
    OrdersExportBuilder,
    InventoryLevelsExportBuilder,
    StockMovementsExportBuilder,
    TasksExportBuilder,
    KpisExportBuilder,
    MenuItemsExportBuilder,
    FeedbackExportBuilder,
    WasteLogExportBuilder,
    PrepBatchesExportBuilder,
    PurchaseOrdersExportBuilder,
    VendorPricingExportBuilder,
  ],
  exports: [ExportsService],
})
export class ExportsModule implements OnModuleInit {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly ordersExportBuilder: OrdersExportBuilder,
    private readonly inventoryLevelsExportBuilder: InventoryLevelsExportBuilder,
    private readonly stockMovementsExportBuilder: StockMovementsExportBuilder,
    private readonly tasksExportBuilder: TasksExportBuilder,
    private readonly kpisExportBuilder: KpisExportBuilder,
    private readonly menuItemsExportBuilder: MenuItemsExportBuilder,
    private readonly feedbackExportBuilder: FeedbackExportBuilder,
    private readonly wasteLogExportBuilder: WasteLogExportBuilder,
    private readonly prepBatchesExportBuilder: PrepBatchesExportBuilder,
    private readonly purchaseOrdersExportBuilder: PurchaseOrdersExportBuilder,
    private readonly vendorPricingExportBuilder: VendorPricingExportBuilder,
  ) {}

  onModuleInit() {
    this.exportsService.registerBuilder('orders', this.ordersExportBuilder);
    this.exportsService.registerBuilder(
      'inventory_levels',
      this.inventoryLevelsExportBuilder,
    );
    this.exportsService.registerBuilder(
      'stock_movements',
      this.stockMovementsExportBuilder,
    );
    this.exportsService.registerBuilder('tasks', this.tasksExportBuilder);
    this.exportsService.registerBuilder('kpis', this.kpisExportBuilder);
    this.exportsService.registerBuilder(
      'menu_items',
      this.menuItemsExportBuilder,
    );
    this.exportsService.registerBuilder(
      'feedback',
      this.feedbackExportBuilder,
    );
    this.exportsService.registerBuilder(
      'waste_log',
      this.wasteLogExportBuilder,
    );
    this.exportsService.registerBuilder(
      'prep_batches',
      this.prepBatchesExportBuilder,
    );
    this.exportsService.registerBuilder(
      'purchase_orders',
      this.purchaseOrdersExportBuilder,
    );
    this.exportsService.registerBuilder(
      'vendor_pricing',
      this.vendorPricingExportBuilder,
    );
  }
}
