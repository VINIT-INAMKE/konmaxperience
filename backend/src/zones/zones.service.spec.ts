import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ZonesService } from './zones.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  zone: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('ZonesService', () => {
  let service: ZonesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZonesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ZonesService>(ZonesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns zones with owner relation included', async () => {
      const zones = [
        { id: '1', name: 'Main Kitchen', zone_type: 'kitchen', owner: { id: 'u1', name: 'Alice' } },
      ];
      mockPrisma.zone.findMany.mockResolvedValue(zones);

      const result = await service.findAll();

      expect(mockPrisma.zone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ owner: expect.any(Object) }),
        }),
      );
      expect(result).toEqual(zones);
    });
  });

  describe('create', () => {
    it('creates a zone with provided fields', async () => {
      const dto = { name: 'Main Kitchen', zone_type: 'kitchen' };
      const created = { id: '1', ...dto, status: 'planned', owner: null };
      mockPrisma.zone.create.mockResolvedValue(created);

      const result = await service.create(dto as any);

      expect(mockPrisma.zone.create).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('allows owner to update their zone', async () => {
      const zone = { id: '1', name: 'Old Name', zone_type: 'kitchen', owner_user_id: 'u1', owner: null };
      mockPrisma.zone.findUnique.mockResolvedValue(zone);
      mockPrisma.zone.update.mockResolvedValue({ ...zone, name: 'New Name' });

      const result = await service.update('1', { name: 'New Name' }, 'u1', false);

      expect(mockPrisma.zone.update).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
    });

    it('throws ForbiddenException for non-owner non-admin', async () => {
      const zone = { id: '1', name: 'Main Kitchen', zone_type: 'kitchen', owner_user_id: 'u1', owner: null };
      mockPrisma.zone.findUnique.mockResolvedValue(zone);

      await expect(service.update('1', { name: 'Hack' }, 'u999', false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows admin to update any zone', async () => {
      const zone = { id: '1', name: 'Old', zone_type: 'kitchen', owner_user_id: 'u1', owner: null };
      mockPrisma.zone.findUnique.mockResolvedValue(zone);
      mockPrisma.zone.update.mockResolvedValue({ ...zone, name: 'Admin Updated' });

      const result = await service.update('1', { name: 'Admin Updated' }, 'u999', true);

      expect(mockPrisma.zone.update).toHaveBeenCalled();
      expect(result.name).toBe('Admin Updated');
    });
  });

  describe('remove', () => {
    it('deletes a zone by id', async () => {
      const zone = { id: '1', name: 'Main Kitchen', zone_type: 'kitchen', owner_user_id: null };
      mockPrisma.zone.findUnique.mockResolvedValue(zone);
      mockPrisma.zone.delete.mockResolvedValue(zone);

      const result = await service.remove('1');

      expect(mockPrisma.zone.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(zone);
    });

    it('throws NotFoundException for non-existent zone', async () => {
      mockPrisma.zone.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
