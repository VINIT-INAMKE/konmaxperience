import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ModuleAccessService } from './module-access.service';
import { ModuleAccessController } from './module-access.controller';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

describe('ModuleAccessService', () => {
  let service: ModuleAccessService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      moduleAccess: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleAccessService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ModuleAccessService>(ModuleAccessService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('orders modules by sort_order then module_key', async () => {
      prisma.moduleAccess.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.moduleAccess.findMany).toHaveBeenCalledWith({
        orderBy: [{ sort_order: 'asc' }, { module_key: 'asc' }],
      });
    });
  });

  describe('forRole', () => {
    it('returns only enabled module keys that list the role', async () => {
      prisma.moduleAccess.findMany.mockResolvedValue([
        { module_key: 'mission_control' },
        { module_key: 'kds' },
      ]);

      const result = await service.forRole('BACKEND_LEAD');

      expect(prisma.moduleAccess.findMany).toHaveBeenCalledWith({
        where: { enabled: true, role_codes: { has: 'BACKEND_LEAD' } },
        orderBy: [{ sort_order: 'asc' }],
        select: { module_key: true },
      });
      expect(result).toEqual(['mission_control', 'kds']);
    });

    it('returns an empty list when the role sees nothing', async () => {
      prisma.moduleAccess.findMany.mockResolvedValue([]);

      await expect(service.forRole('UNKNOWN_ROLE')).resolves.toEqual([]);
    });
  });

  describe('update', () => {
    it('throws NotFoundException for an unknown module key', async () => {
      prisma.moduleAccess.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { enabled: false })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.moduleAccess.update).not.toHaveBeenCalled();
    });

    it('updates an existing module', async () => {
      prisma.moduleAccess.findUnique.mockResolvedValue({ module_key: 'kds' });
      prisma.moduleAccess.update.mockResolvedValue({
        module_key: 'kds',
        enabled: false,
      });

      const result = await service.update('kds', {
        enabled: false,
        role_codes: ['TECH_LEAD'],
      });

      expect(prisma.moduleAccess.update).toHaveBeenCalledWith({
        where: { module_key: 'kds' },
        data: { enabled: false, role_codes: ['TECH_LEAD'] },
      });
      expect(result).toEqual({ module_key: 'kds', enabled: false });
    });
  });
});

describe('ModuleAccessController permissions', () => {
  it('requires MANAGE_SYSTEM to update a module', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        ModuleAccessController.prototype.update,
      ),
    ).toBe(Permission.MANAGE_SYSTEM);
  });

  it('leaves the list and mine endpoints open to all staff', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        ModuleAccessController.prototype.findAll,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        ModuleAccessController.prototype.mine,
      ),
    ).toBeUndefined();
  });
});
