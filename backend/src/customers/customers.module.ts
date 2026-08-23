import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerPresenceService } from './customer-presence.service';
import { CustomerPresenceInterceptor } from './customer-presence.interceptor';
import { UsageModule } from '../usage/usage.module';

/**
 * OPS-04.
 *
 * `PrismaModule` and `AuditModule` are `@Global()`, so `UsageModule` — which
 * exports `UsageService` for the customer-visit beat — is the only import.
 *
 * `CustomerPresenceService` and `CustomerPresenceInterceptor` are exported
 * because `AppModule` binds the interceptor as an `APP_INTERCEPTOR`; the
 * binding lives there so it is global, but the code lives here so
 * `last_seen_at` has exactly one owner.
 */
@Module({
  imports: [UsageModule],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CustomerPresenceService,
    CustomerPresenceInterceptor,
  ],
  exports: [
    CustomersService,
    CustomerPresenceService,
    CustomerPresenceInterceptor,
  ],
})
export class CustomersModule {}
