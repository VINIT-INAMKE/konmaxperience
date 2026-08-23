import { BadRequestException } from '@nestjs/common';
import { mockSettings } from '../test-utils/mock-providers';
import { ServiceabilityService } from './serviceability.service';

describe('ServiceabilityService', () => {
  const originalEnv = process.env.DELIVERY_PINCODES;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.DELIVERY_PINCODES;
    else process.env.DELIVERY_PINCODES = originalEnv;
  });

  function build(pincodes: string[] = []) {
    const settings = mockSettings({ delivery_pincodes: pincodes });
    return {
      settings,
      service: new ServiceabilityService(settings as never),
    };
  }

  it('reads the allow-list from SystemSetting, not the environment', async () => {
    process.env.DELIVERY_PINCODES = '999999';
    const { service, settings } = build(['560001', '560002']);

    await expect(service.allowedPincodes()).resolves.toEqual([
      '560001',
      '560002',
    ]);
    expect(settings.get).toHaveBeenCalledWith('delivery_pincodes');
    await expect(service.isServiceable('560001')).resolves.toBe(true);
    await expect(service.isServiceable('999999')).resolves.toBe(false);
  });

  it('falls back to DELIVERY_PINCODES only while the setting is empty', async () => {
    process.env.DELIVERY_PINCODES = ' 560001 , 560002 ';
    const { service } = build([]);

    await expect(service.allowedPincodes()).resolves.toEqual([
      '560001',
      '560002',
    ]);
    await expect(service.isServiceable('560002')).resolves.toBe(true);
    await expect(service.isServiceable('110001')).resolves.toBe(false);
  });

  it('treats an unconfigured allow-list as no restriction', async () => {
    delete process.env.DELIVERY_PINCODES;
    const { service } = build([]);

    await expect(service.allowedPincodes()).resolves.toEqual([]);
    await expect(service.isServiceable('999999')).resolves.toBe(true);
    await expect(service.assertLocalServiceable(null)).resolves.toBeUndefined();
  });

  it('trims stored pincodes and the pincode under test', async () => {
    delete process.env.DELIVERY_PINCODES;
    const { service } = build([' 560001 ']);

    await expect(service.allowedPincodes()).resolves.toEqual(['560001']);
    await expect(service.isServiceable(' 560001 ')).resolves.toBe(true);
  });

  it('demands an address once a restriction exists', async () => {
    delete process.env.DELIVERY_PINCODES;
    const { service } = build(['560001']);

    await expect(service.assertLocalServiceable(null)).rejects.toThrow(
      new BadRequestException('Please select a delivery address'),
    );
  });

  it('rejects a pincode outside the allow-list with the storefront message', async () => {
    delete process.env.DELIVERY_PINCODES;
    const { service } = build(['560001']);

    await expect(
      service.assertLocalServiceable({ pincode: '999999' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.assertLocalServiceable({ pincode: '999999' }),
    ).rejects.toThrow("Sorry, we don't deliver to this pincode yet");
    await expect(
      service.assertLocalServiceable({ pincode: '560001' }),
    ).resolves.toBeUndefined();
  });
});
