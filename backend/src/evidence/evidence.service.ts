import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApprovalEntityType,
  ApprovalScope,
  ApprovalStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { Permission } from '../types/permissions';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { TasksService } from '../tasks/tasks.service';
import { ApprovalPolicyService } from '../approvals/approval-policy.service';
import { blendMeterValue } from '../readiness/derivation/meter-value';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  userActor,
} from '../common/events/domain-events';

/**
 * Everything the after-commit `task.validated` emit needs. `validateTask` runs
 * *inside* a caller's transaction, so it never emits itself — it hands this seed
 * back and the public entry point (or `ApprovalsService.decide`) emits once the
 * enclosing transaction has committed (SPEC §4.1).
 */
export interface TaskValidatedSeed {
  taskId: string;
  nodeId: string;
  title: string;
  ownerUserId: string;
  questId: string | null;
  missionId: string;
  readinessMeterId: string | null;
  validXp: number;
}

export interface ValidateTaskResult {
  valid: boolean;
  valid_xp: number;
  /** True only on the `false → true` transition, so the event fires once. */
  newly_valid: boolean;
  user: { id: string; xp_total: number; level: number };
  /** Non-null only when `newly_valid`; stripped before the HTTP response. */
  event: TaskValidatedSeed | null;
}

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly approvalPolicy: ApprovalPolicyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getFeed(status?: string, limit = 20, cursor?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.approval_status = status;
    if (cursor) where.created_at = { lt: new Date(cursor) };

    return this.prisma.evidence.findMany({
      where,
      include: {
        task: { select: { title: true } },
        uploader: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async findAll(
    filters: { status?: string },
    scopeFilter: Record<string, unknown>,
  ) {
    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.approval_status = filters.status;
    }

    // Apply scope filter to the task relation
    if (Object.keys(scopeFilter).length > 0) {
      where.task = scopeFilter;
    }

    return this.prisma.evidence.findMany({
      where,
      include: {
        uploader: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            quest: { select: { id: true, title: true } },
            mission: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { created_at: 'asc' },
      take: 200,
    });
  }

  async findByTask(taskId: string) {
    return this.prisma.evidence.findMany({
      where: { task_id: taskId },
      include: {
        uploader: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${id} not found`);
    }

    return evidence;
  }

  async create(
    taskId: string,
    uploaderId: string,
    uploaderRoleCode: string,
    dto: CreateEvidenceDto,
  ) {
    // Verify the task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, owner_user_id: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Verify the uploader is the task owner or has admin permission
    const isOwner = task.owner_user_id === uploaderId;
    if (!isOwner) {
      const perms = await getPermissionsForRole(
        uploaderRoleCode,
        this.prisma,
      );
      if (!perms.includes(Permission.UPDATE_ANY_TASK)) {
        throw new ForbiddenException(
          'You can only upload evidence to your own tasks',
        );
      }
    }

    return this.prisma.evidence.create({
      data: {
        task_id: taskId,
        uploaded_by: uploaderId,
        type: dto.type,
        url: dto.url,
        notes: dto.notes,
        approval_status: ApprovalStatus.pending,
      },
      include: {
        uploader: { select: { id: true, name: true } },
      },
    });
  }

  // --- Approval / Rejection / Validation Cascade ---

  /**
   * Calculate effective XP based on task type.
   * core: 100%, adhoc: 70%, improvement: 80%
   */
  calculateEffectiveXp(task: { xp: number; task_type: string }): number {
    switch (task.task_type) {
      case 'core':
        return task.xp;
      case 'adhoc':
        return Math.floor(task.xp * 0.7);
      case 'improvement':
        return Math.floor(task.xp * 0.8);
      default:
        return 0;
    }
  }

  /**
   * Recalculate total XP and level for a user based on valid tasks.
   * Level thresholds: <200 = 1, <500 = 2, <1000 = 3, >=1000 = 4
   */
  async recalculateUserXp(userId: string, tx: any): Promise<void> {
    const result = await tx.task.aggregate({
      where: { owner_user_id: userId, valid: true },
      _sum: { valid_xp: true },
    });

    const xpTotal = result._sum.valid_xp || 0;

    let level = 1;
    if (xpTotal >= 1000) {
      level = 4;
    } else if (xpTotal >= 500) {
      level = 3;
    } else if (xpTotal >= 200) {
      level = 2;
    }

    await tx.user.update({
      where: { id: userId },
      data: { xp_total: xpTotal, level },
    });
  }

  /**
   * Apply or revoke readiness events for a task.
   * Supports idempotent creation and revocation with recomputation.
   * Accepts optional pre-fetched task data to avoid a redundant DB round-trip.
   */
  async applyReadinessFromTask(
    taskId: string,
    isValid: boolean,
    tx: any,
    taskData?: { readiness_meter_id: string | null; readiness_value: number | null },
  ): Promise<void> {
    const task = taskData ?? await tx.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        readiness_meter_id: true,
        readiness_value: true,
      },
    });

    if (!task || !task.readiness_meter_id) return;

    if (isValid) {
      // Check for existing active event (idempotent)
      const existing = await tx.taskReadinessEvent.findFirst({
        where: {
          task_id: taskId,
          readiness_meter_id: task.readiness_meter_id,
          revoked_at: null,
        },
      });

      if (!existing) {
        await tx.taskReadinessEvent.create({
          data: {
            task_id: taskId,
            readiness_meter_id: task.readiness_meter_id,
            value: task.readiness_value,
            applied: true,
          },
        });
      }
    } else {
      // Revoke all active events for this task
      await tx.taskReadinessEvent.updateMany({
        where: {
          task_id: taskId,
          readiness_meter_id: task.readiness_meter_id,
          revoked_at: null,
        },
        data: {
          revoked_at: new Date(),
          applied: false,
        },
      });
    }

    // ALWAYS recompute the task-driven half from all active events…
    const sumResult = await tx.taskReadinessEvent.aggregate({
      where: {
        readiness_meter_id: task.readiness_meter_id,
        revoked_at: null,
      },
      _sum: { value: true },
    });

    const taskValue = Math.min(Number(sumResult._sum.value ?? 0), 100);

    // …then publish `current_value` through the one shared blend rule
    // (SPEC §4.3 / P3 decision 10) so the task-driven half and the formula half
    // can never write the published value by two different rules.
    const meter = await tx.readinessMeter.findUnique({
      where: { id: task.readiness_meter_id },
      select: { id: true, mode: true, derived_value: true },
    });
    if (!meter) return;

    await tx.readinessMeter.update({
      where: { id: meter.id },
      data: {
        task_value: taskValue,
        current_value: blendMeterValue(
          meter.mode,
          taskValue,
          meter.derived_value,
        ),
        last_computed_at: new Date(),
      },
    });
  }

  /**
   * Validate a task atomically within a transaction.
   * Sets valid=true only when: status=done + approved evidence + approvals satisfied.
   * Also recalculates user XP, quest progress, mission progress, and readiness.
   *
   * P3 decision 4 — `requires_approval: true` with **zero** `Approval` rows now
   * BLOCKS validation. v1 treated "no rows" as satisfied, which meant the
   * approval gate never actually ran; `ApprovalPolicyService.isSatisfied`
   * returns false for zero rows, so a task that declares it needs sign-off must
   * carry policy-generated rows and satisfy the policy's `mode`/`min_approvals`.
   */
  async validateTask(taskId: string, tx: any): Promise<ValidateTaskResult> {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        node_id: true,
        title: true,
        status: true,
        xp: true,
        task_type: true,
        domain: true,
        valid: true,
        requires_approval: true,
        owner_user_id: true,
        quest_id: true,
        mission_id: true,
        readiness_meter_id: true,
        readiness_value: true,
        // Use _count with filters instead of loading full relations.
        // Approvals are NOT a Task relation (`Approval.entity_id` is polymorphic,
        // SPEC §3.5) — they are resolved by the policy service below.
        _count: {
          select: {
            evidence: { where: { approval_status: ApprovalStatus.approved } },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const hasApprovedEvidence = task._count.evidence > 0;

    let approvalsSatisfied = true;
    if (task.requires_approval) {
      approvalsSatisfied = await this.approvalPolicy.isSatisfied(
        tx,
        ApprovalEntityType.task,
        taskId,
        ApprovalScope.task,
        task.domain,
      );
    }

    const isValid =
      task.status === TaskStatus.done &&
      hasApprovedEvidence &&
      approvalsSatisfied;

    const newlyValid = isValid && task.valid !== true;

    const validXp = isValid ? this.calculateEffectiveXp(task) : 0;

    // Update task: valid, valid_xp, and verified atomically
    await tx.task.update({
      where: { id: taskId },
      data: {
        valid: isValid,
        valid_xp: validXp,
        verified: isValid,
      },
    });

    // Cascade: recalculate everything
    await this.recalculateUserXp(task.owner_user_id, tx);
    await this.tasksService.recalculateQuestProgress(task.quest_id, tx);
    await this.tasksService.recalculateMissionProgress(task.mission_id, tx);
    await this.applyReadinessFromTask(taskId, isValid, tx, {
      readiness_meter_id: task.readiness_meter_id,
      readiness_value: task.readiness_value,
    });

    const updatedUser = await tx.user.findUnique({
      where: { id: task.owner_user_id },
      select: { id: true, xp_total: true, level: true },
    });

    return {
      valid: isValid,
      valid_xp: validXp,
      newly_valid: newlyValid,
      user: updatedUser,
      event: newlyValid
        ? {
            taskId: task.id,
            nodeId: task.node_id,
            title: task.title,
            ownerUserId: task.owner_user_id,
            questId: task.quest_id ?? null,
            missionId: task.mission_id,
            readinessMeterId: task.readiness_meter_id ?? null,
            validXp,
          }
        : null,
    };
  }

  /**
   * SPEC §4.1 — emits `task.validated` AFTER the enclosing transaction commits.
   * A no-op when the task did not flip `false → true`, and never throws
   * (`emitDomainEvent` swallows listener failures).
   */
  emitTaskValidated(
    seed: TaskValidatedSeed | null,
    actorUserId: string | null,
  ): void {
    if (!seed) return;
    emitDomainEvent(this.eventEmitter, DomainEvent.TASK_VALIDATED, {
      ...domainEventBase(seed.nodeId, userActor(actorUserId)),
      taskId: seed.taskId,
      title: seed.title,
      ownerUserId: seed.ownerUserId,
      questId: seed.questId,
      missionId: seed.missionId,
      readinessMeterId: seed.readinessMeterId,
      validXp: seed.validXp,
    });
  }

  /** Drops the internal after-commit seed from a validation result. */
  static publicResult(
    result: ValidateTaskResult,
  ): Omit<ValidateTaskResult, 'event'> {
    const { event: _event, ...rest } = result;
    return rest;
  }

  /**
   * Approve evidence and trigger the full validation cascade.
   * Everything runs in a single prisma.$transaction.
   * Self-approval is blocked (403).
   */
  async approveEvidence(
    evidenceId: string,
    reviewerId: string,
    reviewerRoleCode?: string,
  ): Promise<Omit<ValidateTaskResult, 'event'>> {
    const result: ValidateTaskResult = await this.prisma.$transaction(async (tx: any) => {
      const evidence = await tx.evidence.findUnique({
        where: { id: evidenceId },
      });

      if (!evidence) {
        throw new NotFoundException(
          `Evidence with ID ${evidenceId} not found`,
        );
      }

      // Self-approval check — admin can override
      if (evidence.uploaded_by === reviewerId && reviewerRoleCode !== 'FOUNDER_ADMIN') {
        throw new ForbiddenException('Cannot approve your own evidence');
      }

      await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          approval_status: ApprovalStatus.approved,
          reviewed_by: reviewerId,
          reviewed_at: new Date(),
        },
      });

      return this.validateTask(evidence.task_id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    this.emitTaskValidated(result.event, reviewerId);
    return EvidenceService.publicResult(result);
  }

  /**
   * Reject evidence with a required reason, then re-validate the task.
   * Self-rejection is also blocked (403).
   */
  async rejectEvidence(
    evidenceId: string,
    reviewerId: string,
    notes: string,
    reviewerRoleCode?: string,
  ): Promise<void> {
    const result: ValidateTaskResult | undefined = await this.prisma.$transaction(async (tx: any) => {
      const evidence = await tx.evidence.findUnique({
        where: { id: evidenceId },
      });

      if (!evidence) {
        throw new NotFoundException(
          `Evidence with ID ${evidenceId} not found`,
        );
      }

      // Self-rejection check — admin can override
      if (evidence.uploaded_by === reviewerId && reviewerRoleCode !== 'FOUNDER_ADMIN') {
        throw new ForbiddenException('Cannot reject your own evidence');
      }

      await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          approval_status: ApprovalStatus.rejected,
          reviewed_by: reviewerId,
          reviewed_at: new Date(),
          notes,
        },
      });

      // Re-validate: task may become invalid if this was the only approved evidence
      return this.validateTask(evidence.task_id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // A rejection can still flip a task valid (e.g. a second, approved evidence
    // row already satisfied the gate), so the same after-commit emit applies.
    this.emitTaskValidated(result?.event ?? null, reviewerId);
  }
}
