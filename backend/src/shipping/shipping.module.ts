import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module'; // provides RedisService
import { ManualProvider } from './manual.provider';
import { SHIPPING_FETCH, ShiprocketAdapter } from './shiprocket.adapter';
import { ShippingProviderResolver } from './shipping-provider.resolver';

/**
 * SPEC §5.3. Importable on its own; `app.module.ts` registration is Task 11's
 * (shipments queue) — this module has no controllers, so nothing is exposed
 * until a consumer imports it.
 */
@Module({
  imports: [SettingsModule, CustomerAuthModule],
  providers: [
    ManualProvider,
    ShiprocketAdapter,
    ShippingProviderResolver,
    // The single HTTP seam, provided explicitly so an e2e run can override it.
    {
      provide: SHIPPING_FETCH,
      useValue: (input: string, init: RequestInit) => fetch(input, init),
    },
  ],
  exports: [ShippingProviderResolver, ManualProvider, ShiprocketAdapter],
})
export class ShippingModule {}
