import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { NodeModule } from './node/node.module';
import { AuditModule } from './audit/audit.module';
import { ApprovalPolicyModule } from './approvals/approval-policy.module';
import { AuthModule } from './auth/auth.module';
import { PermissionsModule } from './permissions/permissions.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { EmailModule } from './email/email.module';
import { MissionsModule } from './missions/missions.module';
import { QuestsModule } from './quests/quests.module';
import { TasksModule } from './tasks/tasks.module';
import { StorageModule } from './storage/storage.module';
import { EvidenceModule } from './evidence/evidence.module';
import { ReadinessModule } from './readiness/readiness.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { KpisModule } from './kpis/kpis.module';
import { SettingsModule } from './settings/settings.module';
import { ModuleAccessModule } from './module-access/module-access.module';
import { DecisionsModule } from './decisions/decisions.module';
import { DelegationsModule } from './delegations/delegations.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ZonesModule } from './zones/zones.module';
import { BrandsModule } from './brands/brands.module';
import { ChannelsModule } from './channels/channels.module';
import { AssetsModule } from './assets/assets.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { IngredientCategoriesModule } from './ingredient-categories/ingredient-categories.module';
import { VendorsModule } from './vendors/vendors.module';
import { RecipesModule } from './recipes/recipes.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ProcurementModule } from './procurement/procurement.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { OrdersModule } from './orders/orders.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsModule } from './notifications/notifications.module';
import { FeedbackModule } from './feedback/feedback.module';
import { EventsModule } from './events/events.module';
import { GuidesModule } from './guides/guides.module';
import { ExportsModule } from './exports/exports.module';
import { ImportsModule } from './imports/imports.module';
import { ChatModule } from './chat/chat.module';
import { CustomerAuthModule } from './customer-auth/customer-auth.module';
import { RazorpayModule } from './razorpay/razorpay.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CustomerOrdersModule } from './customer-orders/customer-orders.module';
import { ActivityModule } from './activity/activity.module';
import { MissionBridgeModule } from './mission-bridge/mission-bridge.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsageModule } from './usage/usage.module';
import { MeModule } from './me/me.module';
import { SearchModule } from './search/search.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { validate } from './config/env.validation';
import { THROTTLER_CONFIG } from './config/throttler.config';
import { UserAwareThrottlerGuard } from './common/guards/user-aware-throttler.guard';
// P5a wave 2 — commerce modules. Kept on their own lines at the end of both
// blocks so concurrent phases adding imports do not collide with this one.
import { LoyaltyModule } from './loyalty/loyalty.module';
import { CheckoutModule } from './checkout/checkout.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { ShippingModule } from './shipping/shipping.module';
import { PromotionsModule } from './promotions/promotions.module';
import { RefundsModule } from './refunds/refunds.module';
import { ReviewsModule } from './reviews/reviews.module';
// P5a wave 5 — staff customers screen. `CustomerPresenceInterceptor` is bound
// globally below so every customer-authenticated request refreshes
// `Customer.last_seen_at` (throttled to one write per customer per 15 minutes).
import { CustomersModule } from './customers/customers.module';
import { CustomerPresenceInterceptor } from './customers/customer-presence.interceptor';
// P6 wave 1 — the AI port (RUN-05). No controllers of its own; registered here
// so `AiProviderResolver` is constructed once and wave 2's assist and brief
// surfaces can import `AiModule`. Kept on its own line at the end of both
// blocks so concurrent phases adding imports do not collide with this one.
import { AiModule } from './ai/ai.module';
// P6 wave 2 — the run-it capabilities. Same one-line-each convention as the
// blocks above, so concurrent phases adding imports do not collide with these.
import { DailyCloseModule } from './daily-close/daily-close.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot(THROTTLER_CONFIG),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PrismaModule,
    NodeModule,
    AuditModule,
    ApprovalPolicyModule,
    AuthModule,
    PermissionsModule,
    UsersModule,
    RolesModule,
    MissionsModule,
    QuestsModule,
    TasksModule,
    StorageModule,
    EvidenceModule,
    EmailModule,
    ReadinessModule,
    LeaderboardModule,
    KpisModule,
    SettingsModule,
    ModuleAccessModule,
    DecisionsModule,
    DelegationsModule,
    ApprovalsModule,
    ZonesModule,
    BrandsModule,
    ChannelsModule,
    AssetsModule,
    IngredientsModule,
    IngredientCategoriesModule,
    CatalogModule,
    RecipesModule,
    VendorsModule,
    InventoryModule,
    PurchaseOrdersModule,
    ProcurementModule,
    KitchenModule,
    OrdersModule,
    AnalyticsModule,
    NotificationsModule,
    FeedbackModule,
    EventsModule,
    GuidesModule,
    ExportsModule,
    ImportsModule,
    ChatModule,
    CustomerAuthModule,
    RazorpayModule,
    WebhooksModule,
    CustomerOrdersModule,
    ActivityModule,
    MissionBridgeModule,
    LoyaltyModule,
    CheckoutModule,
    ShipmentsModule,
    ShippingModule,
    PromotionsModule,
    RefundsModule,
    RealtimeModule,
    UsageModule,
    MeModule,
    SearchModule,
    ReviewsModule,
    CustomersModule,
    AiModule,
    DailyCloseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
    // Guards run before interceptors, so `req.user` is already decoded here.
    { provide: APP_INTERCEPTOR, useClass: CustomerPresenceInterceptor },
  ],
})
export class AppModule {}
