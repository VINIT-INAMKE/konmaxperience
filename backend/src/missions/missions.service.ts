import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { Permission } from '../types/permissions';

export interface ReadinessImpactEntry {
  meter_code: string;
  meter_label: string;
  total_value: number;
}

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregate readiness impact for a set of missions.
   * Chain: Mission → Tasks (valid=true, readiness_meter_id != null) → group by readiness_meter.
   * Returns a map of mission_id → ReadinessImpactEntry[].
   */
  private async aggregateReadinessImpact(
    missionIds: string[],
  ): Promise<Record<string, ReadinessImpactEntry[]>> {
    if (missionIds.length === 0) return {};

    // Fetch all valid tasks with a readiness meter across these missions
    const tasks = await this.prisma.task.findMany({
      where: {
        mission_id: { in: missionIds },
        valid: true,
        readiness_meter_id: { not: null },
        readiness_value: { gt: 0 },
      },
      select: {
        mission_id: true,
        readiness_value: true,
        readiness_meter: {
          select: { code: true, name: true },
        },
      },
    });

    // Group by mission_id → meter_code → sum
    const map: Record<string, Record<string, { label: string; total: number }>> = {};
    for (const t of tasks) {
      if (!t.readiness_meter) continue;
      const missionBucket = (map[t.mission_id] ??= {});
      const meterKey = t.readiness_meter.code;
      if (!missionBucket[meterKey]) {
        missionBucket[meterKey] = { label: t.readiness_meter.name, total: 0 };
      }
      missionBucket[meterKey].total += t.readiness_value;
    }

    // Convert to sorted arrays (highest total first)
    const result: Record<string, ReadinessImpactEntry[]> = {};
    for (const missionId of Object.keys(map)) {
      result[missionId] = Object.entries(map[missionId])
        .map(([code, { label, total }]) => ({
          meter_code: code,
          meter_label: label,
          total_value: total,
        }))
        .sort((a, b) => b.total_value - a.total_value);
    }
    return result;
  }

  async findAll(
    requestingUser: { id: string; roleCode: string },
    page?: number,
    limit?: number,
  ) {
    const perms = await getPermissionsForRole(requestingUser.roleCode, this.prisma);
    const isAdmin = perms.includes(Permission.VIEW_ALL);

    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const where: Record<string, unknown> = {};
    if (!isAdmin) {
      // Non-admin sees only missions where they own a quest or a task
      where.OR = [
        { created_by: requestingUser.id },
        { quests: { some: { owner_user_id: requestingUser.id } } },
        { tasks: { some: { owner_user_id: requestingUser.id } } },
      ];
    }

    const missions = await this.prisma.mission.findMany({
      where,
      include: {
        _count: { select: { quests: true } },
      },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });

    // Attach readiness impact per mission
    const impactMap = await this.aggregateReadinessImpact(missions.map((m) => m.id));
    return missions.map((m) => ({
      ...m,
      readiness_impact: impactMap[m.id] ?? [],
    }));
  }

  async findAllForExport(): Promise<any[]> {
    return this.prisma.mission.findMany({
      include: {
        _count: { select: { quests: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        quests: {
          select: {
            id: true,
            title: true,
            status: true,
            week_number: true,
            owner_user_id: true,
            progress_percent: true,
            core_progress_percent: true,
            adhoc_progress_percent: true,
          },
        },
      },
    });

    if (!mission) {
      throw new NotFoundException(`Mission with ID ${id} not found`);
    }

    const impactMap = await this.aggregateReadinessImpact([id]);
    return {
      ...mission,
      readiness_impact: impactMap[id] ?? [],
    };
  }

  async create(dto: CreateMissionDto, userId: string) {
    return this.prisma.mission.create({
      data: {
        title: dto.title,
        description: dto.description,
        phase: dto.phase,
        scope: dto.scope,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
        created_by: userId,
      },
    });
  }

  async getMissionControl(requestingUser: { id: string; roleCode: string }) {
    const perms = await getPermissionsForRole(requestingUser.roleCode, this.prisma);
    const isAdmin = perms.includes(Permission.VIEW_ALL);

    const missionWhere: Record<string, unknown> = { status: 'active' };
    if (!isAdmin) {
      missionWhere.OR = [
        { created_by: requestingUser.id },
        { quests: { some: { owner_user_id: requestingUser.id } } },
        { tasks: { some: { owner_user_id: requestingUser.id } } },
      ];
    }

    const [activeMissions, meters, pendingCount, blockerCount, overdueCount] = await Promise.all([
      this.prisma.mission.findMany({
        where: missionWhere,
        include: {
          _count: { select: { quests: true, tasks: true } },
          quests: {
            select: { id: true, title: true, status: true, progress_percent: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.readinessMeter.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.evidence.count({ where: { approval_status: 'pending' } }),
      this.prisma.task.count({ where: { blocked: true, status: 'blocked' } }),
      this.prisma.task.count({
        where: {
          status: { notIn: ['done', 'cancelled'] },
          due_date: { lt: new Date() },
        },
      }),
    ]);

    // Attach readiness impact to each active mission
    const impactMap = await this.aggregateReadinessImpact(activeMissions.map((m) => m.id));
    const missionsWithImpact = activeMissions.map((m) => ({
      ...m,
      readiness_impact: impactMap[m.id] ?? [],
    }));

    return {
      missions: missionsWithImpact,
      readiness: meters,
      actionRequired: {
        pendingApprovals: pendingCount,
        blockers: blockerCount,
        overdueTasks: overdueCount,
      },
    };
  }

  async update(id: string, dto: UpdateMissionDto) {
    const existing = await this.prisma.mission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Mission with ID ${id} not found`);
    }

    return this.prisma.mission.update({
      where: { id },
      data: {
        ...dto,
        start_date: dto.start_date === undefined ? undefined : (dto.start_date ? new Date(dto.start_date) : null),
        end_date: dto.end_date === undefined ? undefined : (dto.end_date ? new Date(dto.end_date) : null),
      },
    });
  }
}
