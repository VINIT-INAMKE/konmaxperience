import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeFilter } from '../permissions/scope.filter';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { Permission } from '../types/permissions';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    requestingUser: { id: string; roleCode: string },
    filters: {
      questId?: string;
      missionId?: string;
      status?: string;
      taskType?: string;
      viewAs?: string;
    },
  ) {
    const perms = await getPermissionsForRole(
      requestingUser.roleCode,
      this.prisma,
    );
    const scopedUser = { ...requestingUser, permissions: perms };
    const isAdmin = perms.includes(Permission.VIEW_ALL);

    const where: Record<string, unknown> = {};

    if (filters.questId) {
      // Quest context mode: return ALL tasks for that quest,
      // with is_own flag per task (non-admin sees all tasks but can only edit own)
      where.quest_id = filters.questId;
    } else {
      // Scoped mode: non-admin sees only own tasks
      const scopeFilter = buildScopeFilter(scopedUser);
      Object.assign(where, scopeFilter);
    }

    // Admin viewAs filter
    if (isAdmin && filters.viewAs) {
      where.owner_user_id = filters.viewAs;
    }

    // Additional filters
    if (filters.missionId) {
      where.mission_id = filters.missionId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.taskType) {
      where.task_type = filters.taskType;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        depends_on: { select: { id: true, title: true, status: true } },
        quest: {
          select: {
            id: true,
            title: true,
            mission: { select: { id: true, title: true } },
          },
        },
        readiness_meter: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
      take: 200,
    });

    // Add is_own boolean: admin sees all as is_own=true (can edit anything)
    return tasks.map((task) => ({
      ...task,
      is_own: isAdmin || task.owner_user_id === requestingUser.id,
    }));
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        depends_on: { select: { id: true, title: true, status: true } },
        quest: {
          select: {
            id: true,
            title: true,
            mission: { select: { id: true, title: true } },
          },
        },
        mission: { select: { id: true, title: true } },
        readiness_meter: { select: { id: true, name: true } },
        linked_assets: {
          select: { id: true, name: true, asset_type: true },
        },
        linked_purchase_orders: {
          select: {
            id: true,
            status: true,
            total_amount: true,
            vendor: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async create(dto: CreateTaskDto, userId: string) {
    return this.prisma.task.create({
      data: {
        mission_id: dto.mission_id,
        quest_id: dto.quest_id,
        title: dto.title,
        description: dto.description,
        task_type: dto.task_type,
        domain: dto.domain,
        owner_user_id: dto.owner_user_id,
        priority: dto.priority,
        xp: dto.xp ?? 25,
        depends_on_task_id: dto.depends_on_task_id,
        due_date: dto.due_date ? new Date(dto.due_date) : undefined,
        created_by: userId,
      },
      include: {
        owner: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        depends_on: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    requestingUser: { id: string; roleCode: string },
  ) {
    // Parallelize independent lookups
    const [existing, perms] = await Promise.all([
      this.prisma.task.findUnique({ where: { id } }),
      getPermissionsForRole(requestingUser.roleCode, this.prisma),
    ]);
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Permission check
    const canUpdateAny = perms.includes(Permission.UPDATE_ANY_TASK);
    const canUpdateOwn =
      perms.includes(Permission.UPDATE_OWN_TASK) &&
      existing.owner_user_id === requestingUser.id;

    if (!canUpdateAny && !canUpdateOwn) {
      throw new ForbiddenException(
        'You do not have permission to update this task',
      );
    }

    // B1: Enforce dependency check on task completion
    if (dto.status === 'done' && existing.depends_on_task_id) {
      const depTask = await this.prisma.task.findUnique({
        where: { id: existing.depends_on_task_id },
        select: { id: true, title: true, status: true },
      });
      if (depTask && depTask.status !== 'done') {
        throw new BadRequestException(
          `Cannot complete task: dependency "${depTask.title}" is not yet done`,
        );
      }
    }

    const statusChanged =
      dto.status !== undefined && dto.status !== existing.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};

      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.priority !== undefined) data.priority = dto.priority;
      if (dto.due_date !== undefined)
        data.due_date = dto.due_date ? new Date(dto.due_date) : null;
      if (dto.depends_on_task_id !== undefined)
        data.depends_on_task_id = dto.depends_on_task_id;

      // Handle completed_at
      if (dto.status === 'done') {
        data.completed_at = new Date();
      } else if (statusChanged && existing.status === 'done') {
        data.completed_at = null;
      }

      const updated = await tx.task.update({
        where: { id },
        data,
        include: {
          owner: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          depends_on: { select: { id: true, title: true, status: true } },
        },
      });

      // Recalculate progress if status changed — parallelized (independent aggregations)
      if (statusChanged) {
        await Promise.all([
          this.recalculateQuestProgress(existing.quest_id, tx),
          this.recalculateMissionProgress(existing.mission_id, tx),
        ]);
      }

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return result;
  }

  async block(
    id: string,
    reason: string,
    requestingUser: { id: string; roleCode: string },
  ) {
    // Parallelize independent lookups
    const [existing, perms] = await Promise.all([
      this.prisma.task.findUnique({ where: { id } }),
      getPermissionsForRole(requestingUser.roleCode, this.prisma),
    ]);
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Permission check: owner or UPDATE_ANY_TASK
    const canUpdateAny = perms.includes(Permission.UPDATE_ANY_TASK);
    const isOwner = existing.owner_user_id === requestingUser.id;

    if (!canUpdateAny && !isOwner) {
      throw new ForbiddenException(
        'You do not have permission to block this task',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: 'blocked',
          blocked: true,
          blocked_reason: reason,
        },
        include: {
          owner: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
        },
      });

      // Status changed, recalculate progress — parallelized (independent aggregations)
      await Promise.all([
        this.recalculateQuestProgress(existing.quest_id, tx),
        this.recalculateMissionProgress(existing.mission_id, tx),
      ]);

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Emit AFTER transaction commits (Pitfall 1 compliance)
    try {
      this.eventEmitter.emit('task.blocked', {
        taskId: id,
        taskTitle: result.title,
        ownerUserId: result.owner_user_id,
        blockedReason: reason,
      });
    } catch (e) { /* event emission failed - non-critical */ }

    return result;
  }

  async unblock(
    id: string,
    requestingUser: { id: string; roleCode: string },
  ) {
    // Parallelize independent lookups
    const [existing, perms] = await Promise.all([
      this.prisma.task.findUnique({ where: { id } }),
      getPermissionsForRole(requestingUser.roleCode, this.prisma),
    ]);
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Permission check: owner or UPDATE_ANY_TASK
    const canUpdateAny = perms.includes(Permission.UPDATE_ANY_TASK);
    const isOwner = existing.owner_user_id === requestingUser.id;

    if (!canUpdateAny && !isOwner) {
      throw new ForbiddenException(
        'You do not have permission to unblock this task',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Note: We default to 'todo' because the schema does not store a previous_status.
      // A proper fix would require adding a previous_status column to the Task model.
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: 'todo',
          blocked: false,
          blocked_reason: null,
        },
        include: {
          owner: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
        },
      });

      // Status changed, recalculate progress — parallelized (independent aggregations)
      await Promise.all([
        this.recalculateQuestProgress(existing.quest_id, tx),
        this.recalculateMissionProgress(existing.mission_id, tx),
      ]);

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return result;
  }

  async findBlocked(requestingUser: { id: string; roleCode: string }) {
    const perms = await getPermissionsForRole(
      requestingUser.roleCode,
      this.prisma,
    );

    if (!perms.includes(Permission.VIEW_ALL)) {
      throw new ForbiddenException(
        'Only admins can view the blockers overview',
      );
    }

    return this.prisma.task.findMany({
      where: { blocked: true, status: 'blocked' },
      select: {
        id: true,
        title: true,
        blocked_reason: true,
        owner_user_id: true,
        quest_id: true,
        mission_id: true,
        updated_at: true,
        owner: { select: { id: true, name: true } },
        quest: { select: { id: true, title: true } },
        mission: { select: { id: true, title: true } },
      },
      orderBy: { updated_at: 'asc' },
    });
  }

  async findAllForExport(): Promise<any[]> {
    return this.prisma.task.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        owner: { select: { name: true } },
        quest: { select: { title: true } },
      },
    });
  }

  async recalculateQuestProgress(
    questId: string | null,
    tx: any,
  ): Promise<void> {
    if (!questId) return;

    const quest = await tx.quest.findUnique({
      where: { id: questId },
      select: { id: true, baseline_task_count: true },
    });
    if (!quest) return;

    // Use groupBy to get all task type/valid counts in a single query
    const taskCounts = await tx.task.groupBy({
      by: ['task_type', 'valid'],
      where: { quest_id: questId, task_type: { in: ['core', 'adhoc'] } },
      _count: { id: true },
    });

    let coreValidCount = 0;
    let totalAdhoc = 0;
    let validAdhoc = 0;

    for (const group of taskCounts) {
      if (group.task_type === 'core' && group.valid) {
        coreValidCount = group._count.id;
      }
      if (group.task_type === 'adhoc') {
        totalAdhoc += group._count.id;
        if (group.valid) {
          validAdhoc = group._count.id;
        }
      }
    }

    // Core progress: valid core tasks / baseline_task_count
    const coreProgress =
      quest.baseline_task_count > 0
        ? Math.round((coreValidCount / quest.baseline_task_count) * 100)
        : 0;

    // Adhoc progress: valid adhoc tasks / total adhoc tasks
    const adhocProgress =
      totalAdhoc > 0 ? Math.round((validAdhoc / totalAdhoc) * 100) : 0;

    // Combined progress (weighted: core carries more weight)
    const combinedProgress =
      quest.baseline_task_count > 0
        ? Math.round(
            ((coreValidCount + validAdhoc * 0.7) /
              (quest.baseline_task_count + totalAdhoc * 0.7)) *
              100,
          )
        : 0;

    // IMPORTANT: Do NOT touch quest.status -- status is a separate concern
    await tx.quest.update({
      where: { id: questId },
      data: {
        core_progress_percent: coreProgress,
        adhoc_progress_percent: adhocProgress,
        progress_percent: combinedProgress,
      },
    });
  }

  async recalculateMissionProgress(
    missionId: string,
    tx: any,
  ): Promise<void> {
    const counts = await tx.task.groupBy({
      by: ['valid'],
      where: { mission_id: missionId },
      _count: { id: true },
    });

    let total = 0;
    let validCount = 0;
    for (const group of counts) {
      total += group._count.id;
      if (group.valid) validCount = group._count.id;
    }
    const progress = total > 0 ? Math.round((validCount / total) * 100) : 0;

    // IMPORTANT: Do NOT touch mission.status
    await tx.mission.update({
      where: { id: missionId },
      data: { progress_percent: progress },
    });
  }
}
