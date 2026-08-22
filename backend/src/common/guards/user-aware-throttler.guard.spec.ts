import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { UserAwareThrottlerGuard } from './user-aware-throttler.guard';
import { THROTTLER_CONFIG } from '../../config/throttler.config';
import { AuthController } from '../../auth/auth.controller';
import { AppController } from '../../app.controller';

// Exact key format from node_modules/@nestjs/throttler/dist/throttler.constants.js
const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
const THROTTLER_TTL = 'THROTTLER:TTL';
const THROTTLER_SKIP = 'THROTTLER:SKIP';

function makeGuard() {
  // ctor: (options, storageService, reflector) — no side effects until onModuleInit
  return new UserAwareThrottlerGuard(
    [] as any,
    {} as any,
    new Reflector(),
  );
}

describe('THROTTLER_CONFIG', () => {
  it('registers a throttler named "default" so @Throttle({ default }) overrides apply', () => {
    const names = THROTTLER_CONFIG.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['default', 'short', 'medium', 'long']),
    );
  });

  it('raises the short window to 20 requests per second', () => {
    const short = THROTTLER_CONFIG.find((t) => t.name === 'short')!;
    expect(short).toMatchObject({ ttl: 1000, limit: 20 });
  });

  it('AuthController.login carries a "default" override of 5 per 5 minutes', () => {
    expect(
      Reflect.getMetadata(
        `${THROTTLER_LIMIT}default`,
        AuthController.prototype.login,
      ),
    ).toBe(5);
    expect(
      Reflect.getMetadata(
        `${THROTTLER_TTL}default`,
        AuthController.prototype.login,
      ),
    ).toBe(300000);
  });

  it('health check skips every registered throttler', () => {
    for (const name of ['default', 'short', 'medium', 'long']) {
      expect(
        Reflect.getMetadata(
          `${THROTTLER_SKIP}${name}`,
          AppController.prototype.healthCheck,
        ),
      ).toBe(true);
    }
  });
});

describe('UserAwareThrottlerGuard.getTracker', () => {
  it('keys authenticated staff requests by user id', async () => {
    const req = {
      user: { id: 'user-1', roleCode: 'FOUNDER_ADMIN', type: 'staff' },
      ip: '1.1.1.1',
      headers: {},
    };
    await expect(makeGuard()['getTracker'](req)).resolves.toBe('user:user-1');
  });

  it('keys authenticated customer requests by customer id', async () => {
    const req = {
      user: { customerId: 'cust-9', type: 'customer' },
      ip: '1.1.1.1',
      headers: {},
    };
    await expect(makeGuard()['getTracker'](req)).resolves.toBe('user:cust-9');
  });

  it('prefers cf-connecting-ip for anonymous requests', async () => {
    const req = { ip: '10.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.7' } };
    await expect(makeGuard()['getTracker'](req)).resolves.toBe('203.0.113.7');
  });

  it('falls back to req.ip when the Cloudflare header is absent', async () => {
    const req = { ip: '10.0.0.1', headers: {} };
    await expect(makeGuard()['getTracker'](req)).resolves.toBe('10.0.0.1');
  });
});
