import { validate } from './env.validation';

const LONG_SECRET = 'x'.repeat(32);
const base = { DATABASE_URL: 'postgresql://u:p@h/db', JWT_SECRET: LONG_SECRET };

describe('env validation', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => validate({ JWT_SECRET: LONG_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_SECRET is shorter than 32 chars', () => {
    expect(() => validate({ ...base, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('accepts the minimal development config', () => {
    expect(() => validate({ ...base, NODE_ENV: 'development' })).not.toThrow();
  });

  it('requires the production set when NODE_ENV=production', () => {
    expect(() => validate({ ...base, NODE_ENV: 'production' })).toThrow(
      /DIRECT_DATABASE_URL[\s\S]*JWT_REFRESH_SECRET[\s\S]*R2_ENDPOINT/,
    );
  });

  it('requires both QStash signing keys when QSTASH_TOKEN is set', () => {
    expect(() =>
      validate({ ...base, NODE_ENV: 'development', QSTASH_TOKEN: 'tok' }),
    ).toThrow(/QSTASH_CURRENT_SIGNING_KEY[\s\S]*QSTASH_NEXT_SIGNING_KEY/);
  });

  describe('Shiprocket (SPEC 5.3)', () => {
    const productionBase = {
      ...base,
      NODE_ENV: 'production',
      DIRECT_DATABASE_URL: 'postgresql://u:p@h/db',
      JWT_REFRESH_SECRET: LONG_SECRET,
      FRONTEND_URL: 'https://konma.store',
      R2_ENDPOINT: 'https://r2',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_BUCKET_NAME: 'b',
      R2_PUBLIC_URL: 'https://pub',
      UPSTASH_REDIS_URL: 'rediss://x',
      RAZORPAY_KEY_ID: 'k',
      RAZORPAY_KEY_SECRET: 's',
      RAZORPAY_WEBHOOK_SECRET: 's',
      WHATSAPP_TOKEN: 't',
      WHATSAPP_PHONE_ID: 'p',
    };
    const shiprocketSet = {
      SHIPPING_PROVIDER: 'shiprocket',
      SHIPROCKET_EMAIL: 'ops@konma.io',
      SHIPROCKET_PASSWORD: 'pw',
      SHIPROCKET_PICKUP_LOCATION: 'KONMA-VILLA',
      SHIPROCKET_WEBHOOK_TOKEN: 'w'.repeat(16),
    };

    it('throws in production when SHIPPING_PROVIDER=shiprocket and credentials are missing', () => {
      expect(() =>
        validate({ ...productionBase, SHIPPING_PROVIDER: 'shiprocket' }),
      ).toThrow(
        /SHIPROCKET_EMAIL[\s\S]*SHIPROCKET_PASSWORD[\s\S]*SHIPROCKET_PICKUP_LOCATION[\s\S]*SHIPROCKET_WEBHOOK_TOKEN/,
      );
    });

    it('throws when the webhook token is shorter than 16 chars', () => {
      expect(() =>
        validate({
          ...productionBase,
          ...shiprocketSet,
          SHIPROCKET_WEBHOOK_TOKEN: 'short',
        }),
      ).toThrow(/SHIPROCKET_WEBHOOK_TOKEN/);
    });

    it('passes in production when SHIPPING_PROVIDER is unset', () => {
      expect(() => validate(productionBase)).not.toThrow();
    });

    it('passes in production when SHIPPING_PROVIDER=manual', () => {
      expect(() =>
        validate({ ...productionBase, SHIPPING_PROVIDER: 'manual' }),
      ).not.toThrow();
    });

    it('passes in production with the full Shiprocket set', () => {
      expect(() =>
        validate({ ...productionBase, ...shiprocketSet }),
      ).not.toThrow();
    });

    it('passes in development with SHIPPING_PROVIDER=shiprocket and nothing else', () => {
      expect(() =>
        validate({
          ...base,
          NODE_ENV: 'development',
          SHIPPING_PROVIDER: 'shiprocket',
        }),
      ).not.toThrow();
    });
  });

  it('returns the config untouched on success', () => {
    const cfg = { ...base, NODE_ENV: 'test', EXTRA: '1' };
    expect(validate(cfg)).toBe(cfg);
  });
});
