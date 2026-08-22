import { randomBytes } from 'crypto';

/** Random URL-safe password (base64url alphabet, unbiased). */
export function generatePassword(length = 24): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

export type SeedEnv = Record<string, string | undefined>;

export function isDemoSeedAllowed(env: SeedEnv): boolean {
  return env.NODE_ENV !== 'production' || env.SEED_DEMO_FORCE === 'true';
}

export function assertDemoSeedAllowed(env: SeedEnv): void {
  if (!isDemoSeedAllowed(env)) {
    throw new Error(
      'seed:demo refuses to run when NODE_ENV=production. Set SEED_DEMO_FORCE=true to override deliberately.',
    );
  }
}
