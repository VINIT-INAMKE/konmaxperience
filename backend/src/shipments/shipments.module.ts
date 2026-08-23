import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { ShippingModule } from '../shipping/shipping.module';
import { SettingsModule } from '../settings/settings.module';
import { ChatModule } from '../chat/chat.module';

/**
 * SHIP-03. `PrismaModule` and `AuditModule` are `@Global()`, so only the three
 * feature modules need importing: `ShippingModule` for the provider resolver,
 * `SettingsModule` for `SystemSetting['shipping']`, and `ChatModule` for the
 * `PusherService` the staff queue broadcasts on.
 *
 * `ShipmentsService` is exported because it is the single writer of
 * `Shipment.status`: the Shiprocket webhook (Task 12) calls `applyStatus`, and
 * the storefront order view (Task 9) calls `findForOrder`.
 */
@Module({
  imports: [ShippingModule, SettingsModule, ChatModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
