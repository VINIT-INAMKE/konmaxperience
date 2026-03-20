import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { KpisService } from './kpis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('KpisService', () => {
  let service: KpisService;
  let prisma: any;

  const mockKpi = {
    id: 'kpi-1',
    name: 'Backend API Uptime',
    description: 'Percentage of time API is up',
    unit: '%',
    target_value: 99.9,
    current_value: 95.0,
    status: 'at_risk',
    domain: 'backend',
    updated_at: new Date(),
    tasks: [],
  };

  beforeEach(async () => {
    prisma = {
      kpi: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      task: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpisService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<KpisService>(KpisService);
    jest.clearAllMocks();

    // Re-set $transaction after clearAllMocks
    prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  });

  describe('findAll', () => {
    it('returns all KPIs for FOUNDER_ADMIN role', async () => {
      prisma.kpi.findMany.mockResolvedValue([mockKpi]);

      const result = await service.findAll('FOUNDER_ADMIN');

      expect(prisma.kpi.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { domain: 'asc' },
        }),
      );
      expect(result).toEqual([mockKpi]);
    });

    it('returns all KPIs for BI_LEAD role', async () => {
      prisma.kpi.findMany.mockResolvedValue([mockKpi]);

      const result = await service.findAll('BI_LEAD');

      expect(prisma.kpi.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
      expect(result).toEqual([mockKpi]);
    });

    it('returns only backend KPIs for BACKEND_LEAD role', async () => {
      const backendKpi = { ...mockKpi, domain: 'backend' };
      prisma.kpi.findMany.mockResolvedValue([backendKpi]);

      const result = await service.findAll('BACKEND_LEAD');

      expect(prisma.kpi.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { domain: 'backend' },
        }),
      );
      expect(result).toEqual([backendKpi]);
    });

    it('returns only frontend KPIs for FRONTEND_LEAD role', async () => {
      const frontendKpi = { ...mockKpi, domain: 'frontend' };
      prisma.kpi.findMany.mockResolvedValue([frontendKpi]);

      const result = await service.findAll('FRONTEND_LEAD');

      expect(prisma.kpi.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { domain: 'frontend' },
        }),
      );
      expect(result).toEqual([frontendKpi]);
    });

    it('returns empty array for unknown role with no domain mapping', async () => {
      prisma.kpi.findMany.mockResolvedValue([]);

      const result = await service.findAll('UNKNOWN_ROLE');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns a KPI by id with task includes', async () => {
      prisma.kpi.findUnique.mockResolvedValue(mockKpi);

      const result = await service.findOne('kpi-1');

      expect(prisma.kpi.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'kpi-1' },
        }),
      );
      expect(result).toEqual(mockKpi);
    });

    it('throws NotFoundException when KPI does not exist', async () => {
      prisma.kpi.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a KPI with status defaulting to on_track', async () => {
      const dto = {
        name: 'Test KPI',
        description: 'Test description',
        unit: '%',
        target_value: 100,
        domain: 'backend',
      };

      prisma.kpi.create.mockResolvedValue({ ...dto, id: 'kpi-new', status: 'on_track' });

      const result = await service.create(dto as any);

      expect(prisma.kpi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'on_track',
          }),
        }),
      );
      expect(result.status).toBe('on_track');
    });

    it('uses provided status when specified', async () => {
      const dto = {
        name: 'Test KPI',
        description: 'Test description',
        unit: '%',
        target_value: 100,
        domain: 'backend',
        status: 'at_risk',
      };

      prisma.kpi.create.mockResolvedValue({ ...dto, id: 'kpi-new' });

      await service.create(dto as any);

      expect(prisma.kpi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'at_risk',
          }),
        }),
      );
    });

    it('links tasks after creation when linked_task_ids provided', async () => {
      const dto = {
        name: 'Test KPI',
        description: 'Test description',
        unit: '%',
        target_value: 100,
        domain: 'backend',
        linked_task_ids: ['task-1', 'task-2'],
      };

      const createdKpi = { ...dto, id: 'kpi-new', status: 'on_track' };
      prisma.kpi.create.mockResolvedValue(createdKpi);
      prisma.task.updateMany.mockResolvedValue({ count: 2 });

      await service.create(dto as any);

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['task-1', 'task-2'] } },
        data: { kpi_id: 'kpi-new' },
      });
    });

    it('does not call task.updateMany when no linked_task_ids', async () => {
      const dto = {
        name: 'Test KPI',
        description: 'Test description',
        unit: '%',
        target_value: 100,
        domain: 'backend',
      };

      prisma.kpi.create.mockResolvedValue({ ...dto, id: 'kpi-new', status: 'on_track' });

      await service.create(dto as any);

      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates KPI fields', async () => {
      prisma.kpi.findUnique.mockResolvedValue(mockKpi);
      prisma.kpi.update.mockResolvedValue({ ...mockKpi, current_value: 97.0 });

      const result = await service.update('kpi-1', { current_value: 97.0 } as any);

      expect(prisma.kpi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'kpi-1' },
          data: expect.objectContaining({ current_value: 97.0 }),
        }),
      );
      expect(result.current_value).toBe(97.0);
    });

    it('throws NotFoundException when KPI does not exist', async () => {
      prisma.kpi.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', {}  as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('clears old task links and sets new ones when linked_task_ids provided', async () => {
      prisma.kpi.findUnique.mockResolvedValue(mockKpi);
      prisma.kpi.update.mockResolvedValue(mockKpi);
      prisma.task.updateMany.mockResolvedValue({ count: 2 });

      await service.update('kpi-1', { linked_task_ids: ['task-3', 'task-4'] } as any);

      // First call: clear old links
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { kpi_id: 'kpi-1' },
        data: { kpi_id: null },
      });
      // Second call: set new links
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['task-3', 'task-4'] } },
        data: { kpi_id: 'kpi-1' },
      });
    });

    it('only clears task links when linked_task_ids is empty array', async () => {
      prisma.kpi.findUnique.mockResolvedValue(mockKpi);
      prisma.kpi.update.mockResolvedValue(mockKpi);
      prisma.task.updateMany.mockResolvedValue({ count: 0 });

      await service.update('kpi-1', { linked_task_ids: [] } as any);

      // Should clear but not set (empty array)
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { kpi_id: 'kpi-1' },
        data: { kpi_id: null },
      });
    });
  });
});
