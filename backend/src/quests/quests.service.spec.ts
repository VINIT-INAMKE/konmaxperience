import { Test, TestingModule } from '@nestjs/testing';
import { QuestsService } from './quests.service';
import { PrismaService } from '../prisma/prisma.service';

describe('QuestsService', () => {
  let service: QuestsService;
  let prisma: any;
  let txMock: any;

  const mockQuest = {
    id: 'quest-1',
    mission_id: 'mission-1',
    title: 'Week 1 Setup',
    description: 'Initial setup tasks',
    week_number: 1,
    owner_user_id: 'user-1',
    status: 'planned',
    baseline_task_count: 0,
    core_progress_percent: 0,
    adhoc_progress_percent: 0,
    progress_percent: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    txMock = {
      quest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      task: {
        count: jest.fn(),
      },
    };

    prisma = {
      quest: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      task: {
        count: jest.fn(),
      },
      $transaction: jest.fn((cb: any) => cb(txMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<QuestsService>(QuestsService);
  });

  describe('findAll', () => {
    it('returns quests filtered by missionId when provided', async () => {
      prisma.quest.findMany.mockResolvedValue([mockQuest]);

      await service.findAll({ missionId: 'mission-1' });

      expect(prisma.quest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mission_id: 'mission-1',
          }),
        }),
      );
    });

    it('returns all quests when no missionId provided', async () => {
      prisma.quest.findMany.mockResolvedValue([mockQuest]);

      await service.findAll({});

      const callArgs = prisma.quest.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({});
    });
  });

  describe('create', () => {
    it('creates quest with correct data', async () => {
      const dto = {
        mission_id: 'mission-1',
        title: 'Week 2 Tasks',
        description: 'Second week',
        week_number: 2,
        owner_user_id: 'user-1',
      };
      prisma.quest.create.mockResolvedValue({ id: 'quest-2', ...dto });

      const result = await service.create(dto as any);

      expect(result.title).toBe('Week 2 Tasks');
      expect(prisma.quest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mission_id: 'mission-1',
            week_number: 2,
            owner_user_id: 'user-1',
          }),
        }),
      );
    });
  });

  describe('activate', () => {
    it('sets baseline_task_count by counting core tasks in a transaction', async () => {
      // Quest with baseline_task_count=0 (not yet activated)
      txMock.quest.findUnique.mockResolvedValue({
        ...mockQuest,
        baseline_task_count: 0,
      });
      txMock.task.count.mockResolvedValue(5);
      txMock.quest.update.mockResolvedValue({
        ...mockQuest,
        baseline_task_count: 5,
      });

      // Trigger activate via update with status='active'
      prisma.quest.findUnique.mockResolvedValue(mockQuest);
      prisma.quest.update.mockResolvedValue({
        ...mockQuest,
        status: 'active',
      });

      await service.update('quest-1', { status: 'active' } as any);

      // Verify $transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();

      // Verify task.count was called for core tasks
      expect(txMock.task.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            quest_id: 'quest-1',
            task_type: 'core',
          }),
        }),
      );

      // Verify quest.update was called with baseline_task_count
      expect(txMock.quest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'quest-1' },
          data: { baseline_task_count: 5 },
        }),
      );
    });

    it('does NOT overwrite baseline_task_count if already > 0', async () => {
      // Quest with baseline_task_count already set
      txMock.quest.findUnique.mockResolvedValue({
        ...mockQuest,
        baseline_task_count: 5,
      });

      prisma.quest.findUnique.mockResolvedValue({
        ...mockQuest,
        baseline_task_count: 5,
      });
      prisma.quest.update.mockResolvedValue({
        ...mockQuest,
        status: 'active',
        baseline_task_count: 5,
      });

      await service.update('quest-1', { status: 'active' } as any);

      // $transaction is called but quest.update inside it should NOT be called
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txMock.quest.update).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('triggers activate when status set to active', async () => {
      prisma.quest.findUnique.mockResolvedValue(mockQuest);
      prisma.quest.update.mockResolvedValue({
        ...mockQuest,
        status: 'active',
      });
      txMock.quest.findUnique.mockResolvedValue({
        ...mockQuest,
        baseline_task_count: 0,
      });
      txMock.task.count.mockResolvedValue(3);
      txMock.quest.update.mockResolvedValue({});

      await service.update('quest-1', { status: 'active' } as any);

      // Verify activate was triggered (through $transaction call)
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('does NOT trigger activate when status is not active', async () => {
      prisma.quest.findUnique.mockResolvedValue(mockQuest);
      prisma.quest.update.mockResolvedValue({
        ...mockQuest,
        status: 'completed',
      });

      await service.update('quest-1', { status: 'completed' } as any);

      // No transaction for non-active status
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
