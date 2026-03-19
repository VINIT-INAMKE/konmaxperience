import { Permission } from '../types/permissions';

export interface ScopedUser {
  id: string;
  roleCode: string;
  permissions: string[];
}

export function buildScopeFilter(user: ScopedUser): Record<string, unknown> {
  if (user.permissions.includes(Permission.VIEW_ALL)) {
    return {}; // FOUNDER_ADMIN sees everything
  }
  return { owner_user_id: user.id };
}
