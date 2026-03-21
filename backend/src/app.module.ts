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
import { ScheduleModule } from '@nestjs/schedule';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
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
