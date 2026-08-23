import { Decimal } from '@prisma/client/runtime/library';
import {
  CATALOG_CACHE_TTL_SECONDS,
  CatalogCacheService,
} from './catalog-cache.service';

/**
 * `mock-providers.mockRedisClient()` is owned by P5a Task 1 and does not carry
 * `setex`/`keys`, so this suite builds its own ioredis double rather than
 * editing a file it does not own.
 */
function cacheClient() {
  return {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  };
}

const cacheWith = (client: ReturnType<typeof cacheClient> | null) =>
  new CatalogCacheService({ getClient: () => client } as never);

describe('CatalogCacheService', () => {
  it('returns the cached payload on a hit without computing', async () => {
    const client = cacheClient();
    client.get.mockResolvedValue(JSON.stringify([{ id: 'p1' }]));
    const compute = jest.fn().mockResolvedValue([{ id: 'other' }]);

    await expect(
      cacheWith(client).wrap('products:all', compute),
    ).resolves.toEqual([{ id: 'p1' }]);
    expect(compute).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledWith('catalog:products:all');
  });

  it('computes, stores with a 60 s TTL, and returns on a miss', async () => {
    const client = cacheClient();

    await expect(
      cacheWith(client).wrap('products:all', () =>
        Promise.resolve([{ id: 'p1' }]),
      ),
    ).resolves.toEqual([{ id: 'p1' }]);
    expect(client.setex).toHaveBeenCalledWith(
      'catalog:products:all',
      CATALOG_CACHE_TTL_SECONDS,
      JSON.stringify([{ id: 'p1' }]),
    );
  });

  it('computes without caching when Redis is unavailable', async () => {
    await expect(
      cacheWith(null).wrap('k', () => Promise.resolve('v')),
    ).resolves.toBe('v');
  });

  it('invalidate() deletes every catalog key', async () => {
    const client = cacheClient();
    client.keys.mockResolvedValue([
      'catalog:products:all',
      'catalog:search:q=oil',
    ]);

    await cacheWith(client).invalidate();

    expect(client.keys).toHaveBeenCalledWith('catalog:*');
    expect(client.del).toHaveBeenCalledWith(
      'catalog:products:all',
      'catalog:search:q=oil',
    );
  });

  it('invalidate() does not call del when nothing is cached', async () => {
    const client = cacheClient();
    await cacheWith(client).invalidate();
    expect(client.del).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------
  // Hit and miss must be byte-identical — the reason `normalizeForJson` exists.
  // -------------------------------------------------------------------

  it('emits money as a JSON number on a miss, matching the Decimal interceptor', async () => {
    const client = cacheClient();
    const compute = () =>
      Promise.resolve([{ id: 'p1', base_price: new Decimal('649.00') }]);

    const miss = await cacheWith(client).wrap('products:all', compute);

    expect(miss).toEqual([{ id: 'p1', base_price: 649 }]);
    // The stored copy is the same JSON the next hit will replay.
    const stored: unknown = JSON.parse(client.setex.mock.calls[0][2] as string);
    expect(stored).toEqual(miss);
  });

  it('serialises Date to ISO and bigint counts to numbers', async () => {
    const client = cacheClient();

    const value = await cacheWith(client).wrap('search:q=oil', () =>
      Promise.resolve({
        items: [{ created_at: new Date('2026-08-20T09:14:00.000Z') }],
        facets: { types: [{ type: 'packaged', count: BigInt(3) }] },
      }),
    );

    expect(value).toEqual({
      items: [{ created_at: '2026-08-20T09:14:00.000Z' }],
      facets: { types: [{ type: 'packaged', count: 3 }] },
    });
  });

  it('recomputes when the cached entry is unreadable', async () => {
    const client = cacheClient();
    client.get.mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      cacheWith(client).wrap('products:all', () => Promise.resolve('fresh')),
    ).resolves.toBe('fresh');
  });

  it('still returns the value when the cache write fails', async () => {
    const client = cacheClient();
    client.setex.mockRejectedValue(new Error('OOM'));

    await expect(
      cacheWith(client).wrap('products:all', () => Promise.resolve('fresh')),
    ).resolves.toBe('fresh');
  });

  it('never lets an invalidation failure escape', async () => {
    const client = cacheClient();
    client.keys.mockRejectedValue(new Error('down'));

    await expect(cacheWith(client).invalidate()).resolves.toBeUndefined();
  });
});
