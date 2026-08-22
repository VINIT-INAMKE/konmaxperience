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

  it('returns the config untouched on success', () => {
    const cfg = { ...base, NODE_ENV: 'test', EXTRA: '1' };
    expect(validate(cfg)).toBe(cfg);
  });
});
