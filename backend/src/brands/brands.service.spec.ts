import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  brand: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('BrandsService', () => {
  let service: BrandsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BrandsService>(BrandsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns brands with owner relation included', async () => {
      const brands = [
        { id: '1', name: 'Konma Food', brand_type: 'food', owner: { id: 'u1', name: 'Alice' } },
      ];
      mockPrisma.brand.findMany.mockResolvedValue(brands);

      const result = await service.findAll();

      expect(mockPrisma.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ owner: expect.any(Object) }),
        }),
      );
      expect(result).toEqual(brands);
    });
  });

  describe('create', () => {
    it('creates brand with type and status', async () => {
      const dto = { name: 'Konma Food', brand_type: 'food' };
      const created = { id: '1', ...dto, status: 'idea', owner: null };
      mockPrisma.brand.create.mockResolvedValue(created);

      const result = await service.create(dto as any);

      expect(mockPrisma.brand.create).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('allows owner to update their brand', async () => {
      const brand = { id: '1', name: 'Konma Food', brand_type: 'food', status: 'idea', owner_user_id: 'u1', owner: null };
      mockPrisma.brand.findUnique.mockResolvedValue(brand);
      mockPrisma.brand.update.mockResolvedValue({ ...brand, name: 'New Name' });

      const result = await service.update('1', { name: 'New Name' }, 'u1', false);

      expect(mockPrisma.brand.update).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
    });

    it('rejects non-owner non-admin from updating', async () => {
      const brand = { id: '1', name: 'Konma Food', brand_type: 'food', status: 'idea', owner_user_id: 'u1', owner: null };
      mockPrisma.brand.findUnique.mockResolvedValue(brand);

      await expect(service.update('1', { name: 'Hack' }, 'u999', false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows admin to update any brand', async () => {
      const brand = { id: '1', name: 'Old', brand_type: 'food', status: 'idea', owner_user_id: 'u1', owner: null };
      mockPrisma.brand.findUnique.mockResolvedValue(brand);
      mockPrisma.brand.update.mockResolvedValue({ ...brand, name: 'Admin Updated' });

      const result = await service.update('1', { name: 'Admin Updated' }, 'u999', true);

      expect(mockPrisma.brand.update).toHaveBeenCalled();
      expect(result.name).toBe('Admin Updated');
    });
  });

  describe('remove', () => {
    it('deletes a brand by id', async () => {
      const brand = { id: '1', name: 'Konma Food', brand_type: 'food', owner_user_id: null };
      mockPrisma.brand.findUnique.mockResolvedValue(brand);
      mockPrisma.brand.delete.mockResolvedValue(brand);

      const result = await service.remove('1');

      expect(mockPrisma.brand.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(brand);
    });

    it('throws NotFoundException for non-existent brand', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
