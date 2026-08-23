import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Permission } from '../types/permissions';
import { invalidateRoleCache } from '../permissions/permissions.cache';
import { SYSTEM_ROLE_CODE } from '../common/constants/system-actor';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * P3 — the `SYSTEM` role is the MissionBridge's identity, not an assignable
   * role. It carries zero permissions and its only member is the system user,
   * so it never belongs in the RBAC admin list or the user-create role picker.
   */
  async findAll() {
    return this.prisma.role.findMany({
      where: { code: { not: SYSTEM_ROLE_CODE } },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        permissions: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async updatePermissions(roleId: string, permissions: string[]) {
    // Validate role exists — only need code for guard check + cache invalidation
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, code: true },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Do not allow modification of FOUNDER_ADMIN role permissions
    if (role.code === 'FOUNDER_ADMIN') {
      throw new ForbiddenException(
        'Cannot modify FOUNDER_ADMIN role permissions',
      );
    }

    // The bridge's SYSTEM identity must stay permission-less — granting it any
    // permission would give the system user a way into the API surface.
    if (role.code === SYSTEM_ROLE_CODE) {
      throw new ForbiddenException('Cannot modify SYSTEM role permissions');
    }

    // Validate each permission is a valid Permission enum value
    const validPermissions = Object.values(Permission) as string[];
    for (const perm of permissions) {
      if (!validPermissions.includes(perm)) {
        throw new BadRequestException(
          `Invalid permission: ${perm}. Valid permissions: ${validPermissions.join(', ')}`,
        );
      }
    }

    // Update role permissions
    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: { permissions },
    });

    // Invalidate permission cache for this role
    invalidateRoleCache(role.code);

    return updated;
  }
}
