import { Injectable } from '@nestjs/common';
import { ShippingProvider as ShippingProviderName } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { ManualProvider } from './manual.provider';
import { ShiprocketAdapter } from './shiprocket.adapter';
import type { ShippingProviderPort } from './shipping.types';

/**
 * Resolves the provider **per call** from `SystemSetting['shipping'].provider`
 * (plan decision 10), so switching providers needs no redeploy and tests default to
 * `manual` — no jest run can reach the network.
 */
@Injectable()
export class ShippingProviderResolver {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly manual: ManualProvider,
    private readonly shiprocket: ShiprocketAdapter,
  ) {}

  /** The `SystemSetting['shipping']` block — pickup code and package defaults for pack. */
  async settings() {
    return this.settingsService.get('shipping');
  }

  async get(): Promise<ShippingProviderPort> {
    const { provider } = await this.settingsService.get('shipping');
    return provider === ShippingProviderName.shiprocket
      ? this.shiprocket
      : this.manual;
  }
}
