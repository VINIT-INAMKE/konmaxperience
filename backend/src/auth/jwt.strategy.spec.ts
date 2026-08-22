import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const config = {
    get: jest.fn().mockReturnValue('x'.repeat(32)),
  } as unknown as ConfigService;
  const strategy = new JwtStrategy(config);

  it('maps a staff access token to the request user', async () => {
    await expect(
      strategy.validate({
        userId: 'u1',
        roleCode: 'TECH_LEAD',
        type: 'staff',
        token_use: 'access',
      }),
    ).resolves.toEqual({ id: 'u1', roleCode: 'TECH_LEAD', type: 'staff' });
  });

  it('maps a customer access token to the request user', async () => {
    await expect(
      strategy.validate({
        customerId: 'c1',
        type: 'customer',
        token_use: 'access',
      }),
    ).resolves.toEqual({ customerId: 'c1', type: 'customer' });
  });

  it('rejects a refresh token presented as a bearer token', async () => {
    await expect(
      strategy.validate({
        userId: 'u1',
        roleCode: 'TECH_LEAD',
        type: 'staff',
        token_use: 'refresh',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects legacy tokens without token_use', async () => {
    await expect(
      strategy.validate({
        userId: 'u1',
        roleCode: 'TECH_LEAD',
        type: 'staff',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
