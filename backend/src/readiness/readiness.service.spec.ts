import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReadinessService } from './readiness.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SettingsService,
  SETTING_DEFAULTS,
} from '../settings/settings.service';
import { NodeService } from '../node/node.service';
import {
  mockNodeService,
  mockPrisma,
  type MockPrisma,
} from '../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const READINESS = SETTING_DEFAULTS.readiness;

/** 15:30 in Asia/Kolkata, so the node day key is unambiguously 2026-08-23. */
const NOW = new Date('2026-08-23T10:00:00.000Z');

describe('ReadinessService', () => {
  let service: ReadinessService;
  let prisma: MockPrisma;
  let settings: { get: jest.Mock };

  const mockMeter = {
    id: 'meter-1',
    node_id: NODE_ID,
    code: 'FOOD_QUALITY',
    name: 'Food Quality',
    description: 'Quality of food produced',
    current_value: 50,
    target_value: 100,
    weight: 1.0,
    mode: 'task_driven' as const,
    formula_key: null,
    task_value: 50,
    derived_value: null,
    last_computed_at: null,
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
    prisma = mockPrisma();
    settings = { get: jest.fn().mockResolvedValue(READINESS) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
        { provide: NodeService, useValue: mockNodeService(NODE_ID) },
      ],
    }).compile();

    service = module.get<ReadinessService>(ReadinessService);
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

  describe('findByCode', () => {
    it('looks the meter up on the node + code unique key', async () => {
      prisma.readinessMeter.findUnique.mockResolvedValue(mockMeter);

      const result = await service.findByCode('FOOD_QUALITY');

      expect(prisma.readinessMeter.findUnique).toHaveBeenCalledWith({
        where: { node_id_code: { node_id: NODE_ID, code: 'FOOD_QUALITY' } },
      });
      expect(result).toEqual(mockMeter);
    });

    it('throws NotFoundException naming the code', async () => {
      prisma.readinessMeter.findUnique.mockResolvedValue(null);

      await expect(service.findByCode('SALES')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByCode('SALES')).rejects.toThrow(
        /Readiness meter SALES not found/,
      );
    });
  });

  describe('history', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: NOW });
      prisma.readinessMeter.findUnique.mockResolvedValue(mockMeter);
      prisma.readinessSnapshot.findMany.mockResolvedValue([]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('clamps days to the configured maximum', async () => {
      const result = await service.history('FOOD_QUALITY', 9999);

      expect(result.days).toBe(READINESS.history_max_days);
      expect(prisma.readinessSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            meter_id: 'meter-1',
            // 365-day window ending today is inclusive of 2025-08-24.
            date: { gte: new Date('2025-08-24T00:00:00.000Z') },
          },
        }),
      );
    });

    it('falls back to the configured default window when days is absent', async () => {
      const result = await service.history('FOOD_QUALITY', 0);

      expect(result.days).toBe(READINESS.history_default_days);
    });

    it('returns snapshot points oldest-first followed by today', async () => {
      prisma.readinessSnapshot.findMany.mockResolvedValue([
        {
          date: new Date('2026-08-21T00:00:00.000Z'),
          value: new Prisma.Decimal(40),
        },
        {
          date: new Date('2026-08-22T00:00:00.000Z'),
          value: new Prisma.Decimal(50.5),
        },
      ]);

      const result = await service.history('FOOD_QUALITY', 30);

      expect(prisma.readinessSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { date: 'asc' } }),
      );
      expect(result.points).toEqual([
        { date: '2026-08-21', value: 40 },
        { date: '2026-08-22', value: 50.5 },
        { date: '2026-08-23', value: 50 },
      ]);
    });

    it('returns only today when the meter has no snapshots', async () => {
      const result = await service.history('FOOD_QUALITY', 30);

      expect(result.points).toEqual([{ date: '2026-08-23', value: 50 }]);
    });

    it("supersedes today's stored snapshot with the live current_value", async () => {
      prisma.readinessSnapshot.findMany.mockResolvedValue([
        {
          date: new Date('2026-08-23T00:00:00.000Z'),
          value: new Prisma.Decimal(11),
        },
      ]);

      const result = await service.history('FOOD_QUALITY', 30);

      expect(result.points).toEqual([{ date: '2026-08-23', value: 50 }]);
    });

    it('carries the meter mode and breakdown alongside the points', async () => {
      const result = await service.history('FOOD_QUALITY', 30);

      expect(result).toEqual(
        expect.objectContaining({
          code: 'FOOD_QUALITY',
          name: 'Food Quality',
          mode: 'task_driven',
          formula_key: null,
          current_value: 50,
          task_value: 50,
          derived_value: null,
          target_value: 100,
        }),
      );
    });

    it('propagates the 404 for an unknown code', async () => {
      prisma.readinessMeter.findUnique.mockResolvedValue(null);

      await expect(service.history('NOPE', 30)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('signals', () => {
    beforeEach(() => {
      prisma.readinessMeter.findUnique.mockResolvedValue(mockMeter);
      prisma.readinessSignal.findMany.mockResolvedValue([]);
    });

    it('reads the meter ledger newest first', async () => {
      await service.signals('FOOD_QUALITY', 20);

      expect(prisma.readinessSignal.findMany).toHaveBeenCalledWith({
        where: { meter_id: 'meter-1' },
        orderBy: { created_at: 'desc' },
        take: 20,
      });
    });

    it('caps limit at 100', async () => {
      await service.signals('FOOD_QUALITY', 5000);

      expect(prisma.readinessSignal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('falls back to 20 when limit is absent', async () => {
      await service.signals('FOOD_QUALITY', 0);

      expect(prisma.readinessSignal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
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
