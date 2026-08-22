import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  asset: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('AssetsService', () => {
  let service: AssetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates asset with created_by from user', async () => {
      const dto = { name: 'Recipe v1', asset_type: 'recipe', url: 'https://r2.example.com/key' };
      const created = { id: '1', ...dto, status: 'draft', created_by: 'u1', creator: { id: 'u1', name: 'Alice' }, linked_brand: null };
      mockPrisma.asset.create.mockResolvedValue(created);

      const result = await service.create(dto as any, 'u1');

      expect(mockPrisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ created_by: 'u1', status: 'draft' }),
        }),
      );
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('allows creator to change status from draft to in_review', async () => {
      const asset = { id: '1', name: 'Recipe v1', asset_type: 'recipe', url: 'https://r2.example.com/key', status: 'draft', created_by: 'u1', creator: { id: 'u1', name: 'Alice' }, linked_brand: null };
      mockPrisma.asset.findUnique.mockResolvedValue(asset);
      mockPrisma.asset.update.mockResolvedValue({ ...asset, status: 'in_review' });

      const result = await service.update('1', { status: 'in_review' }, 'u1', false);

      expect(mockPrisma.asset.update).toHaveBeenCalled();
      expect(result.status).toBe('in_review');
    });

    it('allows admin to set any status including approved', async () => {
      const asset = { id: '1', name: 'Recipe v1', asset_type: 'recipe', url: 'https://r2.example.com/key', status: 'in_review', created_by: 'u1', creator: { id: 'u1', name: 'Alice' }, linked_brand: null };
      mockPrisma.asset.findUnique.mockResolvedValue(asset);
      mockPrisma.asset.update.mockResolvedValue({ ...asset, status: 'approved' });

      const result = await service.update('1', { status: 'approved' }, 'u999', true);

      expect(mockPrisma.asset.update).toHaveBeenCalled();
      expect(result.status).toBe('approved');
    });

    it('throws ForbiddenException for non-creator non-admin', async () => {
      const asset = { id: '1', name: 'Recipe v1', asset_type: 'recipe', url: 'https://r2.example.com/key', status: 'draft', created_by: 'u1', creator: { id: 'u1', name: 'Alice' }, linked_brand: null };
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      await expect(service.update('1', { status: 'in_review' }, 'u999', false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when creator tries to approve (forbidden status transition)', async () => {
      const asset = { id: '1', name: 'Recipe v1', asset_type: 'recipe', url: 'https://r2.example.com/key', status: 'draft', created_by: 'u1', creator: { id: 'u1', name: 'Alice' }, linked_brand: null };
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      await expect(service.update('1', { status: 'approved' }, 'u1', false)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('with status filter returns filtered results', async () => {
      const assets = [
        { id: '1', name: 'Recipe v1', status: 'draft', creator: { id: 'u1', name: 'Alice' }, linked_brand: null },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await service.findAll('draft');

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'draft' }),
        }),
      );
      expect(result).toEqual(assets);
    });

    it('returns all assets when no status filter', async () => {
      const assets = [
        { id: '1', name: 'Recipe v1', status: 'draft', creator: { id: 'u1', name: 'Alice' }, linked_brand: null },
        { id: '2', name: 'SOP v1', status: 'approved', creator: { id: 'u1', name: 'Alice' }, linked_brand: null },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await service.findAll();

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
