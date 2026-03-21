// Cache conversions in memory after first load
let conversionCache: Map<string, number> | null = null;

export async function loadConversions(prisma: any): Promise<Map<string, number>> {
  if (conversionCache) return conversionCache;
  const rows = await prisma.unitConversion.findMany();
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(`${row.from_unit}:${row.to_unit}`, Number(row.factor));
  }
  conversionCache = map;
  return map;
}

export function clearConversionCache() {
  conversionCache = null;
}

export async function convertUnit(
  qty: number,
  fromUnit: string,
  toUnit: string,
  prisma: any,
): Promise<number | null> {
  if (fromUnit === toUnit) return qty;
  const cache = await loadConversions(prisma);
  const factor = cache.get(`${fromUnit}:${toUnit}`);
  if (factor === undefined) return null;
  return qty * factor;
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
