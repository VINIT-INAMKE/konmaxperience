import { Test, TestingModule } from '@nestjs/testing';
import { MissionsService } from './missions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MissionsService', () => {
  let service: MissionsService;
  let prisma: any;

  const mockMission = {
    id: 'mission-1',
    title: 'Food Launch',
    description: 'Launch the food program',
    phase: 'foundation',
    scope: 'food',
    status: 'planned',
    progress_percent: 0,
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    quests: [
      {
        id: 'quest-1',
        title: 'Week 1 Setup',
        status: 'planned',
        progress_percent: 0,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      mission: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MissionsService>(MissionsService);
  });

  describe('findAll', () => {
    it('returns all missions with quest summaries (shared board, no scope filter)', async () => {
      prisma.mission.findMany.mockResolvedValue([mockMission]);

      const result = await service.findAll();

      expect(result).toEqual([mockMission]);
      expect(prisma.mission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            quests: expect.any(Object),
          }),
        }),
      );
      // No scope filter -- shared board
      const callArgs = prisma.mission.findMany.mock.calls[0][0];
      expect(callArgs.where).toBeUndefined();
    });
  });

  describe('create', () => {
    it('stores created_by from userId parameter', async () => {
      const dto = {
        title: 'New Mission',
        description: 'Description',
        phase: 'setup',
        scope: 'food',
      };
      const newMission = { id: 'mission-2', ...dto, created_by: 'user-1' };
      prisma.mission.create.mockResolvedValue(newMission);

      const result = await service.create(dto as any, 'user-1');

      expect(result).toEqual(newMission);
      expect(prisma.mission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            created_by: 'user-1',
            title: 'New Mission',
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('updates mission fields with valid dto', async () => {
      prisma.mission.findUnique.mockResolvedValue(mockMission);
      const updatedMission = { ...mockMission, title: 'Updated Title' };
      prisma.mission.update.mockResolvedValue(updatedMission);

      const result = await service.update('mission-1', {
        title: 'Updated Title',
      } as any);

      expect(result.title).toBe('Updated Title');
      expect(prisma.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mission-1' },
        }),
      );
    });
  });
});
