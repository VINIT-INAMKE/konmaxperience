import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DecisionsService } from '../decisions.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DecisionsService', () => {
  let service: DecisionsService;
  let prisma: any;

  const mockDecision = {
    id: 'decision-1',
    title: 'Adopt new supplier',
    decision_type: 'strategic',
    context: 'We need a reliable supplier for the new season',
    proposed_by: 'user-1',
    proposer: { id: 'user-1', name: 'Alice' },
    impact_scope: 'ops',
    final_decision: null,
    status: 'proposed',
    linked_task_id: null,
    linked_task: null,
    linked_mission_id: null,
    linked_mission: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const approvedDecision = { ...mockDecision, id: 'decision-2', status: 'approved' };

  beforeEach(async () => {
    prisma = {
      decision: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DecisionsService>(DecisionsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns decisions ordered by created_at desc', async () => {
      prisma.decision.findMany.mockResolvedValue([mockDecision]);

      const result = await service.findAll();

      expect(prisma.decision.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
      expect(result).toEqual([mockDecision]);
    });

    it('filters by status when provided', async () => {
      prisma.decision.findMany.mockResolvedValue([mockDecision]);

      await service.findAll('proposed');

      expect(prisma.decision.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'proposed' },
        }),
      );
    });
  });

  describe('create', () => {
    it('creates decision with status=proposed, proposerId, impact_scope=ops', async () => {
      const dto = {
        title: 'New decision',
        decision_type: 'individual',
        context: 'Some context here',
      };
      prisma.decision.create.mockResolvedValue({
        ...mockDecision,
        ...dto,
        proposed_by: 'user-1',
        impact_scope: 'ops',
        status: 'proposed',
      });

      const result = await service.create(dto as any, 'user-1');

      expect(prisma.decision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'proposed',
            proposed_by: 'user-1',
            impact_scope: 'ops',
          }),
        }),
      );
      expect(result.status).toBe('proposed');
    });
  });

  describe('update', () => {
    it('throws ForbiddenException when updating approved decision as non-admin', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);

      await expect(
        service.update('decision-2', { title: 'Changed' }, 'user-1', false),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.update('decision-2', { title: 'Changed' }, 'user-1', false),
      ).rejects.toThrow('Approved decisions are locked. Only admin can reopen.');
    });

    it('succeeds when updating approved decision as admin', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);
      prisma.decision.update.mockResolvedValue({ ...approvedDecision, title: 'Changed' });

      const result = await service.update('decision-2', { title: 'Changed' }, 'admin-1', true);

      expect(prisma.decision.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'decision-2' } }),
      );
      expect(result.title).toBe('Changed');
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when deleting an approved decision', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);

      await expect(
        service.remove('decision-2', false),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.remove('decision-2', false),
      ).rejects.toThrow('Cannot delete an approved decision');
    });

    it('throws ForbiddenException even for admin when decision is approved', async () => {
      prisma.decision.findUnique.mockResolvedValue(approvedDecision);

      await expect(
        service.remove('decision-2', true),
      ).rejects.toThrow('Cannot delete an approved decision');
    });

    it('allows deleting a proposed decision as non-admin', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      prisma.decision.delete.mockResolvedValue(mockDecision);

      const result = await service.remove('decision-1', false);

      expect(prisma.decision.delete).toHaveBeenCalledWith({ where: { id: 'decision-1' } });
      expect(result).toEqual(mockDecision);
    });
  });
});
