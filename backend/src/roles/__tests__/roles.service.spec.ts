import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesService } from '../roles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Permission } from '../../types/permissions';
import { SYSTEM_ROLE_CODE } from '../../common/constants/system-actor';
import { mockPrisma, MockPrisma } from '../../test-utils/mock-providers';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  describe('findAll', () => {
    it('excludes the bridge SYSTEM role from the RBAC list', async () => {
      prisma.role.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: { not: SYSTEM_ROLE_CODE } },
        }),
      );
    });

    it('returns whatever the query yields, ordered by code', async () => {
      const rows = [
        { id: 'r1', code: 'BACKEND_LEAD', name: 'Backend Lead', description: null, permissions: [] },
      ];
      prisma.role.findMany.mockResolvedValue(rows);

      await expect(service.findAll()).resolves.toEqual(rows);
      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { code: 'asc' } }),
      );
    });
  });

  describe('updatePermissions', () => {
    it('refuses to modify the SYSTEM role', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-system',
        code: SYSTEM_ROLE_CODE,
      });

      await expect(
        service.updatePermissions('role-system', [Permission.VIEW_ALL]),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it('refuses to modify the FOUNDER_ADMIN role', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-founder',
        code: 'FOUNDER_ADMIN',
      });

      await expect(
        service.updatePermissions('role-founder', [Permission.VIEW_ALL]),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it('throws when the role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePermissions('nope', [Permission.VIEW_ALL]),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates a normal role', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-backend',
        code: 'BACKEND_LEAD',
      });
      prisma.role.update.mockResolvedValue({
        id: 'role-backend',
        permissions: [Permission.VIEW_ALL],
      });

      await service.updatePermissions('role-backend', [Permission.VIEW_ALL]);

      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: 'role-backend' },
        data: { permissions: [Permission.VIEW_ALL] },
      });
    });
  });
});
