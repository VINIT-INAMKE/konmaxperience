import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Permission } from '../types/permissions';
import { invalidateRoleCache } from '../permissions/permissions.cache';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
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
    // Validate role exists
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
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
