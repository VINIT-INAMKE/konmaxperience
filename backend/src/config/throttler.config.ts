import { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Named throttlers. `@Throttle({ default: {...} })` overrides resolve BY NAME in
 * @nestjs/throttler 6.x, so a throttler literally named "default" must exist or
 * every per-route override in the codebase is silently ignored.
 */
export const THROTTLER_CONFIG: ThrottlerOptions[] = [
  { name: 'default', ttl: 60000, limit: 100 },
  { name: 'short', ttl: 1000, limit: 20 },
  { name: 'medium', ttl: 10000, limit: 20 },
  { name: 'long', ttl: 60000, limit: 100 },
];
