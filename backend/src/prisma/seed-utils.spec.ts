import {
  assertDemoSeedAllowed,
  generatePassword,
  isDemoSeedAllowed,
} from '../../prisma/seed-utils';

describe('generatePassword', () => {
  it('returns a 24-char URL-safe string by default', () => {
    const pw = generatePassword();
    expect(pw).toHaveLength(24);
    expect(pw).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('honours a custom length and is not deterministic', () => {
    expect(generatePassword(40)).toHaveLength(40);
    expect(generatePassword()).not.toBe(generatePassword());
  });
});

describe('demo seed production guard', () => {
  it('allows outside production', () => {
    expect(isDemoSeedAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(() => assertDemoSeedAllowed({})).not.toThrow();
  });

  it('refuses in production by default', () => {
    expect(isDemoSeedAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'production' })).toThrow(
      /SEED_DEMO_FORCE/,
    );
  });

  it('allows in production only with SEED_DEMO_FORCE=true', () => {
    expect(
      isDemoSeedAllowed({ NODE_ENV: 'production', SEED_DEMO_FORCE: 'true' }),
    ).toBe(true);
    expect(
      isDemoSeedAllowed({ NODE_ENV: 'production', SEED_DEMO_FORCE: '1' }),
    ).toBe(false);
  });
});
