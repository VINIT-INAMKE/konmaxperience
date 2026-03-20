import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeFilter } from '../permissions/scope.filter';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { Permission } from '../types/permissions';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
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
        quest: { select: { id: true, title: true } },
        mission: { select: { id: true, title: true } },
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
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Permission check
    const perms = await getPermissionsForRole(
      requestingUser.roleCode,
      this.prisma,
    );
    const canUpdateAny = perms.includes(Permission.UPDATE_ANY_TASK);
    const canUpdateOwn =
      perms.includes(Permission.UPDATE_OWN_TASK) &&
      existing.owner_user_id === requestingUser.id;

    if (!canUpdateAny && !canUpdateOwn) {
      throw new ForbiddenException(
        'You do not have permission to update this task',
      );
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

      // Recalculate progress if status changed
      if (statusChanged) {
        await this.recalculateQuestProgress(existing.quest_id, tx);
        await this.recalculateMissionProgress(existing.mission_id, tx);
      }

      return updated;
    });

    return result;
  }

  async block(
    id: string,
    reason: string,
    requestingUser: { id: string; roleCode: string },
  ) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Permission check: owner or UPDATE_ANY_TASK
    const perms = await getPermissionsForRole(
      requestingUser.roleCode,
      this.prisma,
    );
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

      // Status changed, recalculate progress
      await this.recalculateQuestProgress(existing.quest_id, tx);
      await this.recalculateMissionProgress(existing.mission_id, tx);

      return updated;
    });

    return result;
  }

  async unblock(
    id: string,
    requestingUser: { id: string; roleCode: string },
  ) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Permission check: owner or UPDATE_ANY_TASK
    const perms = await getPermissionsForRole(
      requestingUser.roleCode,
      this.prisma,
    );
    const canUpdateAny = perms.includes(Permission.UPDATE_ANY_TASK);
    const isOwner = existing.owner_user_id === requestingUser.id;

    if (!canUpdateAny && !isOwner) {
      throw new ForbiddenException(
        'You do not have permission to unblock this task',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
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

      // Status changed, recalculate progress
      await this.recalculateQuestProgress(existing.quest_id, tx);
      await this.recalculateMissionProgress(existing.mission_id, tx);

      return updated;
    });

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
      include: {
        owner: { select: { id: true, name: true } },
        quest: { select: { id: true, title: true } },
        mission: { select: { id: true, title: true } },
      },
      orderBy: { updated_at: 'asc' },
    });
  }

  private async recalculateQuestProgress(
    questId: string | null,
    tx: any,
  ): Promise<void> {
    if (!questId) return;

    const quest = await tx.quest.findUnique({ where: { id: questId } });
    if (!quest) return;

    // Core progress: valid core tasks / baseline_task_count
    const coreValidCount = await tx.task.count({
      where: { quest_id: questId, task_type: 'core', valid: true },
    });
    const coreProgress =
      quest.baseline_task_count > 0
        ? Math.round((coreValidCount / quest.baseline_task_count) * 100)
        : 0;

    // Adhoc progress: valid adhoc tasks / total adhoc tasks
    const totalAdhoc = await tx.task.count({
      where: { quest_id: questId, task_type: 'adhoc' },
    });
    const validAdhoc = await tx.task.count({
      where: { quest_id: questId, task_type: 'adhoc', valid: true },
    });
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

  private async recalculateMissionProgress(
    missionId: string,
    tx: any,
  ): Promise<void> {
    const total = await tx.task.count({
      where: { mission_id: missionId },
    });
    const validCount = await tx.task.count({
      where: { mission_id: missionId, valid: true },
    });
    const progress = total > 0 ? Math.round((validCount / total) * 100) : 0;

    // IMPORTANT: Do NOT touch mission.status
    await tx.mission.update({
      where: { id: missionId },
      data: { progress_percent: progress },
    });
  }
}
