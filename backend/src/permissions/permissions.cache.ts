import { PrismaService } from '../prisma/prisma.service';

type PermissionSet = string[];

const cache = new Map<string, { perms: PermissionSet; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function getPermissionsForRole(
  roleCode: string,
  prisma: PrismaService,
): Promise<PermissionSet> {
  const cached = cache.get(roleCode);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.perms;
  }
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  const perms = role?.permissions ?? [];
  cache.set(roleCode, { perms, expiresAt: Date.now() + CACHE_TTL_MS });
  return perms;
}

export function invalidateRoleCache(roleCode: string): void {
  cache.delete(roleCode);
}

export function invalidateAllCache(): void {
  cache.clear();
}
