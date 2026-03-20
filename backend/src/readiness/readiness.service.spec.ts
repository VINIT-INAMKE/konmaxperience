import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReadinessService } from './readiness.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReadinessService', () => {
  let service: ReadinessService;
  let prisma: any;

  const mockMeter = {
    id: 'meter-1',
    code: 'FOOD_QUALITY',
    name: 'Food Quality',
    description: 'Quality of food produced',
    current_value: 50,
    target_value: 100,
    weight: 1.0,
    updated_at: new Date(),
  };

  const mockEvent = {
    id: 'event-1',
    task_id: 'task-1',
    readiness_meter_id: 'meter-1',
    value: 10,
    applied: true,
    revoked_at: null,
    created_at: new Date(),
    task: {
      id: 'task-1',
      title: 'Setup kitchen',
      valid_xp: 50,
      owner: {
        id: 'user-1',
        name: 'Alice',
      },
    },
  };

  beforeEach(async () => {
    prisma = {
      readinessMeter: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      taskReadinessEvent: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReadinessService>(ReadinessService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all readiness meters ordered by code', async () => {
      prisma.readinessMeter.findMany.mockResolvedValue([mockMeter]);

      const result = await service.findAll();

      expect(prisma.readinessMeter.findMany).toHaveBeenCalledWith({
        orderBy: { code: 'asc' },
      });
      expect(result).toEqual([mockMeter]);
    });

    it('returns empty array when no meters exist', async () => {
      prisma.readinessMeter.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findTasksForMeter', () => {
    it('returns TaskReadinessEvents where revoked_at is null with task details', async () => {
      prisma.readinessMeter.findUnique.mockResolvedValue(mockMeter);
      prisma.taskReadinessEvent.findMany.mockResolvedValue([mockEvent]);

      const result = await service.findTasksForMeter('meter-1');

      expect(prisma.taskReadinessEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            readiness_meter_id: 'meter-1',
            revoked_at: null,
          },
        }),
      );
      expect(result).toEqual([mockEvent]);
    });

    it('throws NotFoundException if meter does not exist', async () => {
      prisma.readinessMeter.findUnique.mockResolvedValue(null);

      await expect(service.findTasksForMeter('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('includes task title, valid_xp, and owner name', async () => {
      prisma.readinessMeter.findUnique.mockResolvedValue(mockMeter);
      prisma.taskReadinessEvent.findMany.mockResolvedValue([mockEvent]);

      await service.findTasksForMeter('meter-1');

      expect(prisma.taskReadinessEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            task: expect.objectContaining({
              select: expect.objectContaining({
                title: true,
                valid_xp: true,
                owner: expect.objectContaining({
                  select: expect.objectContaining({
                    name: true,
                  }),
                }),
              }),
            }),
          }),
        }),
      );
    });
  });
});
