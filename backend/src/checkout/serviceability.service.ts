import { BadRequestException, Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

/** The address fields a serviceability check needs — structural, so any row fits. */
export interface ServiceableAddress {
  pincode: string;
}

@Injectable()
export class ServiceabilityService {
  constructor(private readonly settings: SettingsService) {}

  /**
   * The delivery allow-list for **local** (kitchen-fulfilled) lines.
   *
   * The list lives in `SystemSetting['delivery_pincodes']` (decision 18) so an
   * operator can widen the delivery radius from the admin screen without a
   * deploy. `DELIVERY_PINCODES` is kept as a fallback for exactly one case: an
   * environment that configured the env var before the setting existed and has
   * not written the row yet. An empty result means "no restriction configured",
   * which is the P2 behaviour and the seeded default.
   *
   * Shipped lines are *not* covered here — courier serviceability is the
   * provider's answer (`ShippingProviderPort.checkServiceability`), not ours.
   */
  async allowedPincodes(): Promise<string[]> {
    const configured = await this.settings.get('delivery_pincodes');
    const fromSetting = (Array.isArray(configured) ? configured : [])
      .map((p) => String(p).trim())
      .filter(Boolean);
    if (fromSetting.length > 0) return fromSetting;
    return (process.env.DELIVERY_PINCODES ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  /** True when `pincode` is deliverable, or when no allow-list is configured. */
  async isServiceable(pincode: string): Promise<boolean> {
    const allowed = await this.allowedPincodes();
    if (allowed.length === 0) return true;
    return allowed.includes(pincode.trim());
  }

  /**
   * Guard for a quote that carries local lines and is not a pickup. Throws the
   * message the storefront shows verbatim.
   */
  async assertLocalServiceable(
    address: ServiceableAddress | null | undefined,
  ): Promise<void> {
    const allowed = await this.allowedPincodes();
    if (allowed.length === 0) return; // no restriction configured
    if (!address) {
      throw new BadRequestException('Please select a delivery address');
    }
    if (!allowed.includes(address.pincode.trim())) {
      throw new BadRequestException(
        "Sorry, we don't deliver to this pincode yet",
      );
    }
  }
}
