import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../permissions/permissions.cache', () => ({
  getPermissionsForRole: jest.fn(),
}));

describe('EvidenceService', () => {
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
    owner_user_id: uploaderId,
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

  function setupTxDefaults() {
    txMock.task.update.mockResolvedValue({
      ...mockTask,
      valid: true,
      valid_xp: 100,
    });
    txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 100 } });
    txMock.user.update.mockResolvedValue({});
    txMock.quest.findUnique.mockResolvedValue(null);
    txMock.task.count.mockResolvedValue(0);
    txMock.mission.update.mockResolvedValue({});
  }

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

    // Re-set $transaction mock after clearAllMocks
    prisma.$transaction = jest.fn((cb: any) => cb(txMock));
  });

  // ---- approveEvidence ----

  describe('approveEvidence', () => {
    it('sets approval_status to approved with reviewer and timestamp', async () => {
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);
      txMock.evidence.update.mockResolvedValue({
        ...mockEvidence,
        approval_status: 'approved',
        reviewed_by: reviewerId,
      });
      txMock.task.findUnique.mockResolvedValue(mockTask);
      setupTxDefaults();

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

    it('throws ForbiddenException when uploaded_by === reviewerId (self-approval)', async () => {
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);

      await expect(
        service.approveEvidence('evidence-1', uploaderId),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.approveEvidence('evidence-1', uploaderId),
      ).rejects.toThrow('Cannot approve your own evidence');
    });

    it('calls validateTask within the transaction', async () => {
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);
      txMock.evidence.update.mockResolvedValue({});
      txMock.task.findUnique.mockResolvedValue(mockTask);
      setupTxDefaults();

      const result = await service.approveEvidence('evidence-1', reviewerId);

      // validateTask was called, evidence was fetched via tx
      expect(txMock.task.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
        }),
      );
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('valid_xp');
    });
  });

  // ---- rejectEvidence ----

  describe('rejectEvidence', () => {
    it('sets approval_status to rejected with notes as rejection reason', async () => {
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);
      txMock.evidence.update.mockResolvedValue({});
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        evidence: [{ ...mockEvidence, approval_status: 'rejected' }],
      });
      txMock.task.update.mockResolvedValue({
        ...mockTask,
        valid: false,
        valid_xp: 0,
      });
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 0 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.task.count.mockResolvedValue(0);
      txMock.mission.update.mockResolvedValue({});

      await service.rejectEvidence('evidence-1', reviewerId, 'Blurry photo');

      expect(txMock.evidence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            approval_status: 'rejected',
            notes: 'Blurry photo',
            reviewed_by: reviewerId,
            reviewed_at: expect.any(Date),
          }),
        }),
      );
    });

    it('throws ForbiddenException when uploaded_by === reviewerId', async () => {
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);

      await expect(
        service.rejectEvidence('evidence-1', uploaderId, 'reason'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---- validateTask ----

  describe('validateTask', () => {
    it('returns valid=true when status=done + approved evidence + approvals satisfied', async () => {
      txMock.task.findUnique.mockResolvedValue(mockTask);
      setupTxDefaults();

      const result = await (service as any).validateTask('task-1', txMock);

      expect(result).toEqual({ valid: true, valid_xp: 100 });
    });

    it('returns valid=false when status != done', async () => {
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        status: 'doing',
      });
      txMock.task.update.mockResolvedValue({});
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 0 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.task.count.mockResolvedValue(0);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      expect(result).toEqual({ valid: false, valid_xp: 0 });
    });

    it('returns valid=false when no approved evidence exists', async () => {
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        evidence: [{ ...mockEvidence, approval_status: 'pending' }],
      });
      txMock.task.update.mockResolvedValue({});
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 0 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.task.count.mockResolvedValue(0);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      expect(result).toEqual({ valid: false, valid_xp: 0 });
    });

    it('returns valid=false when approval is pending', async () => {
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        approvals: [{ status: 'pending' }],
      });
      txMock.task.update.mockResolvedValue({});
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 0 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.task.count.mockResolvedValue(0);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      expect(result).toEqual({ valid: false, valid_xp: 0 });
    });

    it('valid_xp = task.xp for core type', async () => {
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        task_type: 'core',
        xp: 50,
      });
      txMock.task.update.mockResolvedValue({});
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 50 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.task.count.mockResolvedValue(0);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      expect(result.valid_xp).toBe(50);
    });

    it('valid_xp = Math.floor(task.xp * 0.7) for adhoc type', async () => {
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        task_type: 'adhoc',
        xp: 25,
      });
      txMock.task.update.mockResolvedValue({});
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 17 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.task.count.mockResolvedValue(0);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      // 25 * 0.7 = 17.5 -> Math.floor = 17
      expect(result.valid_xp).toBe(17);
    });

    it('valid_xp = Math.floor(task.xp * 0.8) for improvement type', async () => {
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        task_type: 'improvement',
        xp: 25,
      });
      txMock.task.update.mockResolvedValue({});
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 20 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.task.count.mockResolvedValue(0);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      // 25 * 0.8 = 20
      expect(result.valid_xp).toBe(20);
    });

    it('valid_xp = 0 when task is not valid', async () => {
      txMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        status: 'doing',
      });
      txMock.task.update.mockResolvedValue({});
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 0 } });
      txMock.user.update.mockResolvedValue({});
      txMock.quest.findUnique.mockResolvedValue(null);
      txMock.task.count.mockResolvedValue(0);
      txMock.mission.update.mockResolvedValue({});

      const result = await (service as any).validateTask('task-1', txMock);

      expect(result.valid_xp).toBe(0);
    });

    it('sets verified=true atomically with valid=true', async () => {
      txMock.task.findUnique.mockResolvedValue(mockTask);
      setupTxDefaults();

      await (service as any).validateTask('task-1', txMock);

      expect(txMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valid: true,
            verified: true,
          }),
        }),
      );
    });
  });

  // ---- recalculateQuestProgress ----

  describe('recalculateQuestProgress', () => {
    it('counts only valid=true tasks (not status=done)', async () => {
      txMock.quest.findUnique.mockResolvedValue({
        id: 'quest-1',
        baseline_task_count: 5,
      });

      // 3 core valid, 0 total adhoc, 0 valid adhoc
      txMock.task.count
        .mockResolvedValueOnce(3) // core valid count
        .mockResolvedValueOnce(0) // total adhoc
        .mockResolvedValueOnce(0); // valid adhoc

      txMock.quest.update.mockResolvedValue({});

      await (service as any).recalculateQuestProgress('quest-1', txMock);

      // Verify the count query uses valid: true, not status: 'done'
      expect(txMock.task.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            quest_id: 'quest-1',
            task_type: 'core',
            valid: true,
          }),
        }),
      );

      // core_progress = Math.round((3 / 5) * 100) = 60
      expect(txMock.quest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            core_progress_percent: 60,
          }),
        }),
      );
    });

    it('combined progress uses weighted formula', async () => {
      txMock.quest.findUnique.mockResolvedValue({
        id: 'quest-1',
        baseline_task_count: 5,
      });

      // 3 core valid, 2 total adhoc, 1 valid adhoc
      txMock.task.count
        .mockResolvedValueOnce(3) // core valid
        .mockResolvedValueOnce(2) // total adhoc
        .mockResolvedValueOnce(1); // valid adhoc

      txMock.quest.update.mockResolvedValue({});

      await (service as any).recalculateQuestProgress('quest-1', txMock);

      // combined = Math.round(((3 + 1 * 0.7) / (5 + 2 * 0.7)) * 100)
      //          = Math.round((3.7 / 6.4) * 100) = Math.round(57.8125) = 58
      expect(txMock.quest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            core_progress_percent: 60,
            adhoc_progress_percent: 50,
            progress_percent: 58,
          }),
        }),
      );
    });
  });

  // ---- recalculateMissionProgress ----

  describe('recalculateMissionProgress', () => {
    it('counts only valid=true tasks (not status=done)', async () => {
      // 10 total, 4 valid
      txMock.task.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4); // valid

      txMock.mission.update.mockResolvedValue({});

      await (service as any).recalculateMissionProgress('mission-1', txMock);

      // Verify count query uses valid: true
      expect(txMock.task.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mission_id: 'mission-1',
            valid: true,
          }),
        }),
      );

      // progress = Math.round((4 / 10) * 100) = 40
      expect(txMock.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { progress_percent: 40 },
        }),
      );
    });
  });

  // ---- applyReadinessFromTask ----

  describe('applyReadinessFromTask', () => {
    const taskWithMeter = {
      id: 'task-1',
      readiness_meter_id: 'meter-1',
      readiness_value: 10,
    };

    it('creates TaskReadinessEvent when task becomes valid', async () => {
      txMock.task.findUnique.mockResolvedValue(taskWithMeter);
      txMock.taskReadinessEvent.findFirst.mockResolvedValue(null);
      txMock.taskReadinessEvent.create.mockResolvedValue({});
      txMock.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 10 },
      });
      txMock.readinessMeter.update.mockResolvedValue({});

      await (service as any).applyReadinessFromTask('task-1', true, txMock);

      expect(txMock.taskReadinessEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            task_id: 'task-1',
            readiness_meter_id: 'meter-1',
            value: 10,
            applied: true,
          }),
        }),
      );
    });

    it('skips creation if active event already exists (idempotent)', async () => {
      txMock.task.findUnique.mockResolvedValue(taskWithMeter);
      txMock.taskReadinessEvent.findFirst.mockResolvedValue({
        id: 'event-1',
        revoked_at: null,
      });
      txMock.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 10 },
      });
      txMock.readinessMeter.update.mockResolvedValue({});

      await (service as any).applyReadinessFromTask('task-1', true, txMock);

      expect(txMock.taskReadinessEvent.create).not.toHaveBeenCalled();
    });

    it('revokes active events when task becomes invalid (sets revoked_at)', async () => {
      txMock.task.findUnique.mockResolvedValue(taskWithMeter);
      txMock.taskReadinessEvent.updateMany.mockResolvedValue({ count: 1 });
      txMock.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 0 },
      });
      txMock.readinessMeter.update.mockResolvedValue({});

      await (service as any).applyReadinessFromTask('task-1', false, txMock);

      expect(txMock.taskReadinessEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            task_id: 'task-1',
            revoked_at: null,
          }),
          data: expect.objectContaining({
            revoked_at: expect.any(Date),
            applied: false,
          }),
        }),
      );
    });

    it('validate->revoke->re-validate does not double-count (meter equals single value)', async () => {
      // Step 1: validate (create event, meter=10)
      txMock.task.findUnique.mockResolvedValue(taskWithMeter);
      txMock.taskReadinessEvent.findFirst.mockResolvedValue(null);
      txMock.taskReadinessEvent.create.mockResolvedValue({});
      txMock.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 10 },
      });
      txMock.readinessMeter.update.mockResolvedValue({});

      await (service as any).applyReadinessFromTask('task-1', true, txMock);

      expect(txMock.readinessMeter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { current_value: 10 },
        }),
      );

      jest.clearAllMocks();

      // Step 2: revoke (meter=0)
      txMock.task.findUnique.mockResolvedValue(taskWithMeter);
      txMock.taskReadinessEvent.updateMany.mockResolvedValue({ count: 1 });
      txMock.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 0 },
      });
      txMock.readinessMeter.update.mockResolvedValue({});

      await (service as any).applyReadinessFromTask('task-1', false, txMock);

      expect(txMock.readinessMeter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { current_value: 0 },
        }),
      );

      jest.clearAllMocks();

      // Step 3: re-validate (new event, meter=10 -- not 20)
      txMock.task.findUnique.mockResolvedValue(taskWithMeter);
      txMock.taskReadinessEvent.findFirst.mockResolvedValue(null);
      txMock.taskReadinessEvent.create.mockResolvedValue({});
      txMock.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 10 }, // Only the new event (old was revoked)
      });
      txMock.readinessMeter.update.mockResolvedValue({});

      await (service as any).applyReadinessFromTask('task-1', true, txMock);

      // meter value is 10, not 20 (no double-count)
      expect(txMock.readinessMeter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { current_value: 10 },
        }),
      );
    });

    it('meter value capped at 100', async () => {
      txMock.task.findUnique.mockResolvedValue(taskWithMeter);
      txMock.taskReadinessEvent.findFirst.mockResolvedValue(null);
      txMock.taskReadinessEvent.create.mockResolvedValue({});
      txMock.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 150 },
      });
      txMock.readinessMeter.update.mockResolvedValue({});

      await (service as any).applyReadinessFromTask('task-1', true, txMock);

      expect(txMock.readinessMeter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { current_value: 100 },
        }),
      );
    });
  });

  // ---- recalculateUserXp ----

  describe('recalculateUserXp', () => {
    it('sums valid_xp from valid tasks', async () => {
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 350 } });
      txMock.user.update.mockResolvedValue({});

      await (service as any).recalculateUserXp('user-1', txMock);

      expect(txMock.task.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { owner_user_id: 'user-1', valid: true },
          _sum: { valid_xp: true },
        }),
      );

      expect(txMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { xp_total: 350, level: 2 },
        }),
      );
    });

    it('level=1 for xp<200', async () => {
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 100 } });
      txMock.user.update.mockResolvedValue({});

      await (service as any).recalculateUserXp('user-1', txMock);

      expect(txMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { xp_total: 100, level: 1 },
        }),
      );
    });

    it('level=2 for xp>=200 and xp<500', async () => {
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 200 } });
      txMock.user.update.mockResolvedValue({});

      await (service as any).recalculateUserXp('user-1', txMock);

      expect(txMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { xp_total: 200, level: 2 },
        }),
      );
    });

    it('level=3 for xp>=500 and xp<1000', async () => {
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 999 } });
      txMock.user.update.mockResolvedValue({});

      await (service as any).recalculateUserXp('user-1', txMock);

      expect(txMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { xp_total: 999, level: 3 },
        }),
      );
    });

    it('level=4 for xp>=1000', async () => {
      txMock.task.aggregate.mockResolvedValue({ _sum: { valid_xp: 1500 } });
      txMock.user.update.mockResolvedValue({});

      await (service as any).recalculateUserXp('user-1', txMock);

      expect(txMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { xp_total: 1500, level: 4 },
        }),
      );
    });
  });

  // ---- calculateEffectiveXp ----

  describe('calculateEffectiveXp', () => {
    it('returns task.xp for core type', () => {
      expect(service.calculateEffectiveXp({ xp: 100, task_type: 'core' })).toBe(100);
    });

    it('returns Math.floor(task.xp * 0.7) for adhoc type', () => {
      expect(service.calculateEffectiveXp({ xp: 25, task_type: 'adhoc' })).toBe(17);
    });

    it('returns Math.floor(task.xp * 0.8) for improvement type', () => {
      expect(service.calculateEffectiveXp({ xp: 25, task_type: 'improvement' })).toBe(20);
    });

    it('returns 0 for unknown type', () => {
      expect(service.calculateEffectiveXp({ xp: 100, task_type: 'unknown' })).toBe(0);
    });
  });
});
