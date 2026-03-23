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
import { AnalyticsModule } from '../analytics/analytics.module';
import { DecisionsModule } from '../decisions/decisions.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { EventsModule } from '../events/events.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { VendorsModule } from '../vendors/vendors.module';
import { RecipesModule } from '../recipes/recipes.module';
import { OrdersExportBuilder } from './builders/orders.builder';
import {
  RevenueExportBuilder,
  TopItemsExportBuilder,
  ChannelBreakdownExportBuilder,
  RecipeCostsExportBuilder,
} from './builders/analytics.builder';
import {
  InventoryLevelsExportBuilder,
  StockMovementsExportBuilder,
} from './builders/inventory.builder';
import {
  TasksExportBuilder,
  KpisExportBuilder,
  DecisionLogExportBuilder,
  LeaderboardExportBuilder,
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
import {
  EventsExportBuilder,
  EventGuestListsExportBuilder,
} from './builders/events.builder';
import {
  IngredientsExportBuilder,
  VendorsExportBuilder,
  RecipesExportBuilder,
} from './builders/master-data.builder';

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
    AnalyticsModule,
    DecisionsModule,
    LeaderboardModule,
    EventsModule,
    IngredientsModule,
    VendorsModule,
    RecipesModule,
  ],
  controllers: [ExportsController],
  providers: [
    ExportsService,
    OrdersExportBuilder,
    RevenueExportBuilder,
    TopItemsExportBuilder,
    ChannelBreakdownExportBuilder,
    RecipeCostsExportBuilder,
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
    EventsExportBuilder,
    EventGuestListsExportBuilder,
    DecisionLogExportBuilder,
    LeaderboardExportBuilder,
    IngredientsExportBuilder,
    VendorsExportBuilder,
    RecipesExportBuilder,
  ],
  exports: [ExportsService],
})
export class ExportsModule implements OnModuleInit {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly ordersExportBuilder: OrdersExportBuilder,
    private readonly revenueExportBuilder: RevenueExportBuilder,
    private readonly topItemsExportBuilder: TopItemsExportBuilder,
    private readonly channelBreakdownExportBuilder: ChannelBreakdownExportBuilder,
    private readonly recipeCostsExportBuilder: RecipeCostsExportBuilder,
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
    private readonly eventsExportBuilder: EventsExportBuilder,
    private readonly eventGuestListsExportBuilder: EventGuestListsExportBuilder,
    private readonly decisionLogExportBuilder: DecisionLogExportBuilder,
    private readonly leaderboardExportBuilder: LeaderboardExportBuilder,
    private readonly ingredientsExportBuilder: IngredientsExportBuilder,
    private readonly vendorsExportBuilder: VendorsExportBuilder,
    private readonly recipesExportBuilder: RecipesExportBuilder,
  ) {}

  onModuleInit() {
    this.exportsService.registerBuilder('orders', this.ordersExportBuilder);
    this.exportsService.registerBuilder(
      'revenue_summary',
      this.revenueExportBuilder,
    );
    this.exportsService.registerBuilder(
      'top_items',
      this.topItemsExportBuilder,
    );
    this.exportsService.registerBuilder(
      'channel_breakdown',
      this.channelBreakdownExportBuilder,
    );
    this.exportsService.registerBuilder(
      'recipe_costs',
      this.recipeCostsExportBuilder,
    );
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
    this.exportsService.registerBuilder(
      'events',
      this.eventsExportBuilder,
    );
    this.exportsService.registerBuilder(
      'event_guest_lists',
      this.eventGuestListsExportBuilder,
    );
    this.exportsService.registerBuilder(
      'decision_log',
      this.decisionLogExportBuilder,
    );
    this.exportsService.registerBuilder(
      'leaderboard',
      this.leaderboardExportBuilder,
    );
    this.exportsService.registerBuilder(
      'ingredients',
      this.ingredientsExportBuilder,
    );
    this.exportsService.registerBuilder(
      'vendors',
      this.vendorsExportBuilder,
    );
    this.exportsService.registerBuilder(
      'recipes',
      this.recipesExportBuilder,
    );
  }
}
