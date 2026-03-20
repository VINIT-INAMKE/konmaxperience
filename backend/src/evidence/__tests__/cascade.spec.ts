import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EvidenceService } from '../evidence.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('../../permissions/permissions.cache', () => ({
  getPermissionsForRole: jest.fn(),
}));

describe('EvidenceService - Validation Cascade', () => {
  let service: EvidenceService;
  let prisma: any;
  let txMock: any;

  const reviewerId = 'reviewer-1';
  const uploaderId = 'uploader-1';

  const mockEvidence = {
    id: 'evidence-1',
    task_id: 'task-1',
    uploaded_by: uploaderId,
    type: 'photo',
    url: 'https://example.com/photo.jpg',
    notes: null,
    approval_status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
  };

  const mockTask = {
    id: 'task-1',
    mission_id: 'mission-1',
    quest_id: 'quest-1',
    owner_user_id: 'uploader-1',
    status: 'done',
    task_type: 'core',
    xp: 100,
    valid: false,
    valid_xp: 0,
    verified: false,
    requires_approval: true,
    readiness_meter_id: null,
    readiness_value: 0,
    evidence: [{ ...mockEvidence, approval_status: 'approved' }],
    approvals: [{ status: 'approved' }],
  };

  beforeEach(async () => {
    txMock = {
      evidence: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      quest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      mission: {
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'uploader-1', xp_total: 100, level: 1 }),
      },
      taskReadinessEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
      },
      readinessMeter: {
        update: jest.fn(),
      },
    };

    prisma = {
      evidence: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((cb: any) => cb(txMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
    jest.clearAllMocks();
  });

  describe('approveEvidence', () => {
    it('sets approval_status to approved with reviewer and timestamp', async () => {
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);
      txMock.evidence.update.mockResolvedValue({
        ...mockEvidence,
        approval_status: 'approved',
        reviewed_by: reviewerId,
      });
      txMock.task.findUnique.mockResolvedValue(mockTask);
      txMock.task.update.mockResolvedValue({ ...mockTask, valid: true, valid_xp: 100 });
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 100 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.mission.update.mockResolvedValue({});

      await service.approveEvidence('evidence-1', reviewerId);

      expect(txMock.evidence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evidence-1' },
          data: expect.objectContaining({
            approval_status: 'approved',
            reviewed_by: reviewerId,
            reviewed_at: expect.any(Date),
          }),
        }),
      );
    });

    it('throws ForbiddenException for self-approval', async () => {
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);

      await expect(
        service.approveEvidence('evidence-1', uploaderId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectEvidence', () => {
    it('sets approval_status to rejected with notes', async () => {
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);
      txMock.evidence.update.mockResolvedValue({
        ...mockEvidence,
        approval_status: 'rejected',
        notes: 'Blurry photo',
      });
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        evidence: [{ ...mockEvidence, approval_status: 'rejected' }],
      });
      txMock.task.update.mockResolvedValue({ ...mockTask, valid: false, valid_xp: 0 });
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 0 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.mission.update.mockResolvedValue({});

      await service.rejectEvidence('evidence-1', reviewerId, 'Blurry photo');

      expect(txMock.evidence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            approval_status: 'rejected',
            notes: 'Blurry photo',
          }),
        }),
      );
    });
  });

  describe('validateTask', () => {
    it('sets valid=true when status=done + approved evidence + approvals satisfied', async () => {
      txMock.task.findUnique.mockResolvedValue(mockTask);
      txMock.task.update.mockResolvedValue({ ...mockTask, valid: true, valid_xp: 100 });
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 100 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      expect(result).toEqual({ valid: true, valid_xp: 100, user: { id: 'uploader-1', xp_total: 100, level: 1 } });
      expect(txMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valid: true,
            valid_xp: 100,
            verified: true,
          }),
        }),
      );
    });

    it('sets valid=false when status is not done', async () => {
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        status: 'doing',
      });
      txMock.task.update.mockResolvedValue({ ...mockTask, valid: false, valid_xp: 0 });
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 0 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      expect(result).toEqual({ valid: false, valid_xp: 0, user: { id: 'uploader-1', xp_total: 100, level: 1 } });
    });

    it('sets valid=false when no approved evidence', async () => {
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        evidence: [{ ...mockEvidence, approval_status: 'pending' }],
      });
      txMock.task.update.mockResolvedValue({ ...mockTask, valid: false, valid_xp: 0 });
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 0 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      expect(result).toEqual({ valid: false, valid_xp: 0, user: { id: 'uploader-1', xp_total: 100, level: 1 } });
    });
  });

  describe('calculateEffectiveXp', () => {
    it('returns task.xp for core type', () => {
      const result = (service as any).calculateEffectiveXp({ xp: 100, task_type: 'core' });
      expect(result).toBe(100);
    });

    it('returns Math.floor(task.xp * 0.7) for adhoc type', () => {
      const result = (service as any).calculateEffectiveXp({ xp: 25, task_type: 'adhoc' });
      expect(result).toBe(17);
    });

    it('returns Math.floor(task.xp * 0.8) for improvement type', () => {
      const result = (service as any).calculateEffectiveXp({ xp: 25, task_type: 'improvement' });
      expect(result).toBe(20);
    });
  });
});
