import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @Public() endpoints skip both auth and permissions (health check, webhooks, etc.)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // Customer tokens can ONLY access endpoints with CustomerGuard — reject everywhere else
    // This prevents customers from reaching staff endpoints that lack @RequiresPermission
    if (user.type === 'customer') return false;

    // Staff endpoints without @RequiresPermission are open to all staff
    if (!required) return true;

    const perms = await getPermissionsForRole(user.roleCode, this.prisma);
    return perms.includes(required);
  }
}
