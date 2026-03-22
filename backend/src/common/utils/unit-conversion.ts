// Cache conversions in memory with TTL
const conversionCache = new Map<string, number>();
let cacheLoadedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function ensureCache(prisma: any): Promise<void> {
  if (conversionCache.size > 0 && Date.now() - cacheLoadedAt < CACHE_TTL) return;
  conversionCache.clear();
  const conversions = await prisma.unitConversion.findMany();
  for (const c of conversions) {
    conversionCache.set(`${c.from_unit}:${c.to_unit}`, Number(c.factor));
  }
  cacheLoadedAt = Date.now();
}

export async function loadConversions(prisma: any): Promise<Map<string, number>> {
  await ensureCache(prisma);
  return conversionCache;
}

export function clearConversionCache() {
  conversionCache.clear();
  cacheLoadedAt = 0;
}

export async function convertUnit(
  qty: number,
  fromUnit: string,
  toUnit: string,
  prisma: any,
): Promise<number | null> {
  if (fromUnit === toUnit) return qty;
  const cache = await loadConversions(prisma);
  const direct = cache.get(`${fromUnit}:${toUnit}`);
  if (direct !== undefined) return qty * direct;
  const reverse = cache.get(`${toUnit}:${fromUnit}`);
  if (reverse !== undefined && reverse !== 0) return qty / reverse;
  return null;
}

// Get all units compatible with a base_unit (reachable via conversion table)
export async function getCompatibleUnits(baseUnit: string, prisma: any): Promise<string[]> {
  const cache = await loadConversions(prisma);
  const units = [baseUnit];
  for (const key of cache.keys()) {
    const [from, to] = key.split(':');
    if (from === baseUnit && !units.includes(to)) units.push(to);
  }
  return units;
}
