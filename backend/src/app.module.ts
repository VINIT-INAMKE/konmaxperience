import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
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
import { MenuModule } from './menu/menu.module';
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
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { validate } from './config/env.validation';
import { THROTTLER_CONFIG } from './config/throttler.config';
import { UserAwareThrottlerGuard } from './common/guards/user-aware-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot(THROTTLER_CONFIG),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PrismaModule,
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
    DecisionsModule,
    DelegationsModule,
    ApprovalsModule,
    ZonesModule,
    BrandsModule,
    ChannelsModule,
    AssetsModule,
    IngredientsModule,
    IngredientCategoriesModule,
    MenuModule,
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
  ],
})
export class AppModule {}
