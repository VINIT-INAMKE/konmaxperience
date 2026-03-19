import {
  getPermissionsForRole,
  invalidateRoleCache,
  invalidateAllCache,
} from './permissions.cache';

describe('permissions.cache', () => {
  const mockPrisma = {
    role: {
      findUnique: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    invalidateAllCache();
    jest.clearAllMocks();
  });

  it('first call fetches from DB and returns permissions', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      code: 'FRONTEND_LEAD',
      permissions: ['VIEW_ROLE_SCOPED', 'CREATE_TASK'],
    });

    const perms = await getPermissionsForRole('FRONTEND_LEAD', mockPrisma);
    expect(perms).toEqual(['VIEW_ROLE_SCOPED', 'CREATE_TASK']);
    expect(mockPrisma.role.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({
      where: { code: 'FRONTEND_LEAD' },
    });
  });

  it('second call within TTL returns cached value without DB call', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      code: 'FRONTEND_LEAD',
      permissions: ['VIEW_ROLE_SCOPED', 'CREATE_TASK'],
    });

    await getPermissionsForRole('FRONTEND_LEAD', mockPrisma);
    const perms = await getPermissionsForRole('FRONTEND_LEAD', mockPrisma);

    expect(perms).toEqual(['VIEW_ROLE_SCOPED', 'CREATE_TASK']);
    expect(mockPrisma.role.findUnique).toHaveBeenCalledTimes(1); // only 1 call, not 2
  });

  it('invalidateRoleCache causes next call to refetch from DB', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      code: 'FRONTEND_LEAD',
      permissions: ['VIEW_ROLE_SCOPED', 'CREATE_TASK'],
    });

    await getPermissionsForRole('FRONTEND_LEAD', mockPrisma);
    expect(mockPrisma.role.findUnique).toHaveBeenCalledTimes(1);

    invalidateRoleCache('FRONTEND_LEAD');

    mockPrisma.role.findUnique.mockResolvedValue({
      code: 'FRONTEND_LEAD',
      permissions: ['VIEW_ROLE_SCOPED', 'CREATE_TASK', 'UPLOAD_EVIDENCE'],
    });

    const perms = await getPermissionsForRole('FRONTEND_LEAD', mockPrisma);
    expect(perms).toEqual([
      'VIEW_ROLE_SCOPED',
      'CREATE_TASK',
      'UPLOAD_EVIDENCE',
    ]);
    expect(mockPrisma.role.findUnique).toHaveBeenCalledTimes(2);
  });

  it('returns empty array if role not found', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);
    const perms = await getPermissionsForRole('NONEXISTENT', mockPrisma);
    expect(perms).toEqual([]);
  });
});
