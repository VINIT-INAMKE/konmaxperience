import { Injectable } from '@nestjs/common';
import { MissionStatus, QuestStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { ModuleAccessService } from '../module-access/module-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { Permission } from '../types/permissions';

export interface HeaderUser {
  id: string;
  name: string;
  email: string;
  streak_days: number;
}

export interface HeaderRole {
  code: string;
  name: string;
}

export interface HeaderNode {
  id: string;
  code: string;
  name: string;
  timezone: string;
  currency: string;
  status: string;
}

export interface HeaderMission {
  id: string;
  title: string;
  phase: string;
  status: string;
}

export interface HeaderQuest {
  id: string;
  title: string;
  week_number: number;
  progress_percent: number;
  mine: boolean;
}

/**
 * SPEC §6.1 — everything the persistent mission header renders, in one round trip.
 * Nine parallel requests on every navigation is not acceptable, so this aggregate
 * is the only call the header makes.
 */
export interface HeaderContext {
  user: HeaderUser | null;
  role: HeaderRole | null;
  node: HeaderNode | null;
  /** SPEC §6.3 module visibility — the same list `GET /modules/mine` returns. */
  module_keys: string[];
  mission: HeaderMission | null;
  quest: HeaderQuest | null;
  readiness_percent: number | null;
  approvals_waiting: number;
  notifications_unread: number;
  my_blockers: number;
  xp_total: number;
  level: number;
  /** True when the caller may start a mission — drives the §6.1 empty-state CTA. */
  can_create_mission: boolean;
}

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly node: NodeService,
    private readonly moduleAccess: ModuleAccessService,
    private readonly notifications: NotificationsService,
    private readonly approvals: ApprovalsService,
  ) {}

  async header(actor: {
    id: string;
    roleCode: string;
    permissions: string[];
  }): Promise<HeaderContext> {
    const now = new Date();
    const [
      user,
      node,
      moduleKeys,
      mission,
      myQuest,
      meters,
      approvals,
      notifications,
      blockers,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: actor.id },
        select: {
          id: true,
          name: true,
          email: true,
          xp_total: true,
          level: true,
          streak_days: true,
          role: { select: { code: true, name: true } },
        },
      }),
      // The node row is process-cached, so this is free after the first call.
      this.node.current().catch(() => null),
      this.moduleAccess.forRole(actor.roleCode),
      this.prisma.mission.findFirst({
        where: { status: MissionStatus.active },
        orderBy: { created_at: 'desc' },
        select: { id: true, title: true, phase: true, status: true },
      }),
      this.prisma.quest.findFirst({
        where: {
          owner_user_id: actor.id,
          status: { in: [QuestStatus.active, QuestStatus.planned] },
          start_date: { lte: now },
          end_date: { gte: now },
        },
        orderBy: { week_number: 'desc' },
        select: {
          id: true,
          title: true,
          week_number: true,
          progress_percent: true,
        },
      }),
      this.prisma.readinessMeter.findMany({ select: { current_value: true } }),
      // Delegation-aware, and the exact number `GET /approvals/count` reports —
      // the header badge and the inbox must never disagree.
      this.approvals.countForUser({ id: actor.id, roleCode: actor.roleCode }),
      this.notifications.unreadCount(actor.id),
      this.prisma.task.count({
        where: {
          owner_user_id: actor.id,
          blocked: true,
          status: { notIn: [TaskStatus.done, TaskStatus.cancelled] },
        },
      }),
    ]);

    let quest: HeaderQuest | null = myQuest ? { ...myQuest, mine: true } : null;
    if (!quest) {
      // No quest of the caller's own this week — fall back to the node's quest so
      // the header still names what the villa is moving.
      const nodeQuest = await this.prisma.quest.findFirst({
        where: {
          status: QuestStatus.active,
          start_date: { lte: now },
          end_date: { gte: now },
        },
        orderBy: { week_number: 'desc' },
        select: {
          id: true,
          title: true,
          week_number: true,
          progress_percent: true,
        },
      });
      quest = nodeQuest ? { ...nodeQuest, mine: false } : null;
    }

    const readiness_percent = meters.length
      ? Math.round(
          meters.reduce((sum, m) => sum + m.current_value, 0) / meters.length,
        )
      : null;

    return {
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            streak_days: user.streak_days,
          }
        : null,
      role: user?.role ? { code: user.role.code, name: user.role.name } : null,
      node: node
        ? {
            id: node.id,
            code: node.code,
            name: node.name,
            timezone: node.timezone,
            currency: node.currency,
            status: node.status,
          }
        : null,
      module_keys: moduleKeys,
      mission,
      quest,
      readiness_percent,
      approvals_waiting: approvals.count,
      notifications_unread: notifications.count,
      my_blockers: blockers,
      xp_total: user?.xp_total ?? 0,
      level: user?.level ?? 1,
      can_create_mission: actor.permissions.includes(Permission.CREATE_MISSION),
    };
  }
}
