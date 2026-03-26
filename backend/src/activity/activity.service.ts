import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { subHours, startOfWeek, startOfMonth } from 'date-fns';
import type { ActivityFeedItem, TeamContributionRow } from './dto/activity-feed.dto';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async buildFeed(options: { limit?: number; hoursLookback?: number } = {}): Promise<ActivityFeedItem[]> {
    const limit = options.limit ?? 50;
    const cutoff = subHours(new Date(), options.hoursLookback ?? 48);

    const [recentValidations, recentReadiness, recentQuestCompletions] = await Promise.all([
      this.prisma.task.findMany({
        where: { valid: true, updated_at: { gte: cutoff } },
        select: {
          id: true, title: true, updated_at: true, valid_xp: true,
          quest: { select: { title: true } },
          owner: { select: { name: true } },
        },
        orderBy: { updated_at: 'desc' },
        take: 20,
      }),
      this.prisma.taskReadinessEvent.findMany({
        where: { created_at: { gte: cutoff }, revoked_at: null },
        include: {
          task: { select: { id: true, title: true } },
          readiness_meter: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      this.prisma.quest.findMany({
        where: { status: 'completed', updated_at: { gte: cutoff } },
        select: { id: true, title: true, updated_at: true, mission: { select: { title: true } } },
        orderBy: { updated_at: 'desc' },
        take: 10,
      }),
    ]);

    const items: ActivityFeedItem[] = [];

    for (const v of recentValidations) {
      items.push({
        id: `val-${v.id}`,
        type: 'validation',
        description: `${v.owner?.name ?? 'Someone'} validated "${v.title}" (+${v.valid_xp} XP)`,
        timestamp: v.updated_at.toISOString(),
        relatedEntityId: v.id,
        relatedEntityType: 'task',
      });
    }

    for (const r of recentReadiness) {
      items.push({
        id: `rdns-${r.id}`,
        type: 'readiness',
        description: `+${r.value} ${r.readiness_meter.name} from "${r.task.title}"`,
        timestamp: r.created_at.toISOString(),
        relatedEntityId: r.task.id,
        relatedEntityType: 'task',
      });
    }

    for (const q of recentQuestCompletions) {
      items.push({
        id: `quest-${q.id}`,
        type: 'quest_complete',
        description: `Quest "${q.title}" completed (${q.mission?.title ?? 'Mission'})`,
        timestamp: q.updated_at.toISOString(),
        relatedEntityId: q.id,
        relatedEntityType: 'quest',
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, limit);
  }

  async getContributions(scope: 'week' | 'month' | 'mission'): Promise<TeamContributionRow[]> {
    let cutoff: Date;
    if (scope === 'week') {
      cutoff = startOfWeek(new Date(), { weekStartsOn: 1 });
    } else if (scope === 'month') {
      cutoff = startOfMonth(new Date());
    } else {
      const oldestActive = await this.prisma.mission.findFirst({
        where: { status: 'active' },
        orderBy: { start_date: 'asc' },
        select: { start_date: true, created_at: true },
      });
      cutoff = oldestActive?.start_date ?? oldestActive?.created_at ?? startOfMonth(new Date());
    }

    const [taskGroups, readinessEvents, users] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['owner_user_id', 'status', 'valid', 'blocked'],
        where: { updated_at: { gte: cutoff } },
        _count: { id: true },
      }),
      this.prisma.taskReadinessEvent.findMany({
        where: { created_at: { gte: cutoff }, revoked_at: null },
        include: {
          task: { select: { owner_user_id: true } },
          readiness_meter: { select: { name: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { status: 'active' },
        select: { id: true, role: { select: { name: true, code: true } } },
      }),
    ]);

    const userRoleMap = new Map(users.map((u) => [u.id, { code: u.role.code, name: u.role.name }]));
    const roleAgg = new Map<string, {
      roleName: string;
      tasksCompleted: number;
      tasksValidated: number;
      blockedCount: number;
      readinessDelta: Map<string, number>;
    }>();

    for (const group of taskGroups) {
      const role = userRoleMap.get(group.owner_user_id);
      if (!role) continue;
      if (!roleAgg.has(role.code)) {
        roleAgg.set(role.code, {
          roleName: role.name,
          tasksCompleted: 0,
          tasksValidated: 0,
          blockedCount: 0,
          readinessDelta: new Map(),
        });
      }
      const agg = roleAgg.get(role.code)!;
      if (group.status === 'done') agg.tasksCompleted += group._count.id;
      if (group.valid) agg.tasksValidated += group._count.id;
      if (group.blocked) agg.blockedCount += group._count.id;
    }

    for (const event of readinessEvents) {
      const role = userRoleMap.get(event.task.owner_user_id);
      if (!role) continue;
      if (!roleAgg.has(role.code)) {
        roleAgg.set(role.code, {
          roleName: role.name,
          tasksCompleted: 0,
          tasksValidated: 0,
          blockedCount: 0,
          readinessDelta: new Map(),
        });
      }
      const agg = roleAgg.get(role.code)!;
      const meterName = event.readiness_meter.name;
      agg.readinessDelta.set(meterName, (agg.readinessDelta.get(meterName) ?? 0) + event.value);
    }

    return Array.from(roleAgg.entries()).map(([roleCode, agg]) => ({
      roleCode,
      roleName: agg.roleName,
      tasksCompleted: agg.tasksCompleted,
      tasksValidated: agg.tasksValidated,
      blockedCount: agg.blockedCount,
      readinessDelta: Array.from(agg.readinessDelta.entries()).map(([meterName, value]) => ({ meterName, value })),
    }));
  }
}
