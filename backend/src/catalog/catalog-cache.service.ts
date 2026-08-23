import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { RedisService } from '../customer-auth/redis.service';

/** SPEC §9: public catalog endpoints are cached 60 s. */
export const CATALOG_CACHE_TTL_SECONDS = 60;

/** Every key this service writes is prefixed, so `invalidate()` can sweep them. */
export const CATALOG_CACHE_PREFIX = 'catalog:';

/**
 * Collapse a Prisma result into the exact JSON the HTTP layer would emit.
 *
 * This is load-bearing, not cosmetic. `Prisma.Decimal.toJSON()` returns a
 * **string**, so a naive `JSON.stringify` would make `base_price` a number on a
 * cache miss (`DecimalSerializationInterceptor`, `main.ts:119`, calls
 * `.toNumber()`) and a string on a cache hit. Normalising on *both* paths — the
 * cached copy and the freshly computed one — makes hit and miss byte-identical.
 *
 * `Date -> ISO string` and `bigint -> number` are here for the same reason:
 * `count(*)::bigint` in the facet query comes back as a `BigInt`, which
 * `JSON.stringify` throws on outright.
 */
export function normalizeForJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Decimal) return value.toNumber();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalized = normalizeForJson(entry);
      // Mirror JSON.stringify: an `undefined` property simply disappears, so
      // the uncached object must lose it too or the two shapes diverge.
      if (normalized !== undefined) out[key] = normalized;
    }
    return out;
  }
  return value;
}

/**
 * A read-through cache for the public catalog surface.
 *
 * Degrades to "always miss" when Redis is unavailable — `RedisService.getClient()`
 * returns `null` when `UPSTASH_REDIS_URL` is unset or the connection died, and
 * the storefront must keep serving in that state. Every Redis call is wrapped:
 * a cache outage may never turn a `200` into a `500`.
 */
@Injectable()
export class CatalogCacheService {
  private readonly logger = new Logger(CatalogCacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Returns the cached payload for `key`, or computes, stores (60 s) and returns it.
   * The value is always JSON-normalised, so callers see the same shape either way.
   */
  async wrap<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const client = this.redis.getClient();
    if (!client) return normalizeForJson(await compute()) as T;

    try {
      const hit = await client.get(CATALOG_CACHE_PREFIX + key);
      if (hit) return JSON.parse(hit) as T;
    } catch (err) {
      this.logger.warn(
        `catalog cache read failed for ${key}: ${(err as Error).message}`,
      );
      return normalizeForJson(await compute()) as T;
    }

    const value = normalizeForJson(await compute());
    try {
      const json = JSON.stringify(value);
      if (json !== undefined) {
        await client.setex(
          CATALOG_CACHE_PREFIX + key,
          CATALOG_CACHE_TTL_SECONDS,
          json,
        );
      }
    } catch (err) {
      this.logger.warn(
        `catalog cache write failed for ${key}: ${(err as Error).message}`,
      );
    }
    return value as T;
  }

  /**
   * Called after every publish/update/archive so a staff edit is visible
   * immediately instead of up to 60 s later. Swallows failures: a stale cache
   * is a worse outcome than a failed write, but a failed *write* is worse still.
   */
  async invalidate(): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    try {
      const keys = await client.keys(`${CATALOG_CACHE_PREFIX}*`);
      if (keys.length > 0) await client.del(...keys);
    } catch (err) {
      this.logger.warn(
        `catalog cache invalidation failed: ${(err as Error).message}`,
      );
    }
  }
}
