import { buildScopeFilter, ScopedUser } from './scope.filter';
import { Permission } from '../types/permissions';

describe('buildScopeFilter', () => {
  it('returns empty object for user with VIEW_ALL permission', () => {
    const user: ScopedUser = {
      id: 'user-1',
      roleCode: 'FOUNDER_ADMIN',
      permissions: [Permission.VIEW_ALL, Permission.MANAGE_RBAC],
    };
    expect(buildScopeFilter(user)).toEqual({});
  });

  it('returns owner filter for user with VIEW_ROLE_SCOPED permission', () => {
    const user: ScopedUser = {
      id: 'user-2',
      roleCode: 'FRONTEND_LEAD',
      permissions: [Permission.VIEW_ROLE_SCOPED, Permission.CREATE_TASK],
    };
    expect(buildScopeFilter(user)).toEqual({ owner_user_id: 'user-2' });
  });

  it('returns owner filter for user without VIEW_ALL or VIEW_ROLE_SCOPED', () => {
    const user: ScopedUser = {
      id: 'user-3',
      roleCode: 'TALENT_LEAD',
      permissions: [Permission.CREATE_TASK],
    };
    expect(buildScopeFilter(user)).toEqual({ owner_user_id: 'user-3' });
  });
});
