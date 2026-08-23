import { SETTING_DEFAULTS } from '../settings/settings.service';
import { ShippingProviderResolver } from './shipping-provider.resolver';
import { ManualProvider } from './manual.provider';

type ShippingSetting = (typeof SETTING_DEFAULTS)['shipping'];

/**
 * `mock-providers.ts` is Task 1's file, so the settings double lives here.
 * The default mirrors the seeded block: `provider = 'manual'`.
 */
function mockSettings(overrides: Partial<ShippingSetting> = {}) {
  const shipping: ShippingSetting = {
    ...SETTING_DEFAULTS.shipping,
    ...overrides,
  };
  return { get: jest.fn().mockResolvedValue(shipping) };
}

describe('ShippingProviderResolver', () => {
  const manual = new ManualProvider();
  const shiprocket = { name: 'shiprocket' } as never;

  it('returns the manual provider by default (seeded shipping.provider = manual)', async () => {
    const resolver = new ShippingProviderResolver(
      mockSettings() as never,
      manual,
      shiprocket,
    );
    await expect(resolver.get()).resolves.toBe(manual);
  });

  it('returns the Shiprocket adapter when the setting says so', async () => {
    const settings = mockSettings({
      provider: 'shiprocket',
      pickup_location_code: 'KONMA-VILLA',
    });
    const resolver = new ShippingProviderResolver(
      settings as never,
      manual,
      shiprocket,
    );
    await expect(resolver.get()).resolves.toBe(shiprocket);
    expect(settings.get).toHaveBeenCalledWith('shipping');
  });

  it('falls back to manual for an unrecognised provider value', async () => {
    const resolver = new ShippingProviderResolver(
      mockSettings({ provider: 'bluedart' as never }) as never,
      manual,
      shiprocket,
    );
    await expect(resolver.get()).resolves.toBe(manual);
  });

  it('re-reads the setting on every call, so a switch needs no redeploy', async () => {
    const settings = mockSettings();
    settings.get
      .mockResolvedValueOnce({ ...SETTING_DEFAULTS.shipping })
      .mockResolvedValueOnce({
        ...SETTING_DEFAULTS.shipping,
        provider: 'shiprocket',
      });
    const resolver = new ShippingProviderResolver(
      settings as never,
      manual,
      shiprocket,
    );

    await expect(resolver.get()).resolves.toBe(manual);
    await expect(resolver.get()).resolves.toBe(shiprocket);
    expect(settings.get).toHaveBeenCalledTimes(2);
  });

  it('exposes the shipping settings block for pack defaults', async () => {
    const resolver = new ShippingProviderResolver(
      mockSettings() as never,
      manual,
      shiprocket,
    );
    await expect(resolver.settings()).resolves.toMatchObject({
      provider: 'manual',
      default_weight_grams: 500,
      default_dimensions_cm: { length: 20, breadth: 15, height: 10 },
    });
  });
});
