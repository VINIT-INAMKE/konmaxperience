import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { BullModule } from '@nestjs/bullmq';
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
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ...((() => {
      if (!process.env.UPSTASH_REDIS_URL) {
        console.warn('[BullMQ] UPSTASH_REDIS_URL not set — notification queue disabled');
        return [];
      }
      try {
        const Redis = require('ioredis');
        let errorLogged = false;
        const conn = new Redis(process.env.UPSTASH_REDIS_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          connectTimeout: 5000,
          lazyConnect: true,
          retryStrategy: (times: number) => {
            if (times > 2) {
              if (!errorLogged) {
                console.warn('[BullMQ] Redis unreachable after 3 attempts — queue disabled. App continues without notifications.');
                errorLogged = true;
              }
              return null; // stop retrying
            }
            return Math.min(times * 1000, 3000);
          },
        });
        conn.on('error', (err: Error) => {
          if (!errorLogged) {
            console.warn(`[BullMQ] Redis error: ${err.message}`);
          }
        });
        return [BullModule.forRoot({ connection: conn })];
      } catch (err) {
        console.warn('[BullMQ] Failed to initialize Redis — notification queue disabled');
        return [];
      }
    })()),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
