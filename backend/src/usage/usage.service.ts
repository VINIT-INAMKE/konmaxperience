import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UsageEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsageEventDto } from './dto/create-usage-event.dto';

export interface UsageSummary {
  days: number;
  by_role: { role_code: string; count: number }[];
  by_path: { path: string | null; count: number }[];
  by_action: { action: string | null; count: number }[];
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget. A telemetry write must never fail a user's request, so every
   * error is swallowed after a debug log — the caller already returned 202.
   */
  async record(
    dto: CreateUsageEventDto,
    actor: { id: string; roleCode: string },
  ): Promise<void> {
    try {
      await this.prisma.usageEvent.create({
        data: {
          user_id: actor.id,
          role_code: actor.roleCode,
          event_type: dto.event_type,
          path:
            dto.event_type === UsageEventType.page_view
              ? (dto.path ?? null)
              : null,
          action:
            dto.event_type === UsageEventType.action
              ? (dto.action ?? null)
              : null,
          meta: (dto.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.debug(`usage event dropped: ${(err as Error).message}`);
    }
  }

  /** Admin roll-up (Phase 35 builds the screen; the data path lands here). */
  async summary(days = 30): Promise<UsageSummary> {
    const since = new Date(Date.now() - days * 86_400_000);
    const [byRole, byPath, byAction] = await Promise.all([
      this.prisma.usageEvent.groupBy({
        by: ['role_code'],
        where: { created_at: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.usageEvent.groupBy({
        by: ['path'],
        where: {
          created_at: { gte: since },
          event_type: UsageEventType.page_view,
        },
        _count: { _all: true },
        orderBy: { _count: { path: 'desc' } },
        take: 25,
      }),
      this.prisma.usageEvent.groupBy({
        by: ['action'],
        where: {
          created_at: { gte: since },
          event_type: UsageEventType.action,
        },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 25,
      }),
    ]);

    return {
      days,
      by_role: byRole.map((r) => ({
        role_code: r.role_code,
        count: r._count._all,
      })),
      by_path: byPath.map((r) => ({ path: r.path, count: r._count._all })),
      by_action: byAction.map((r) => ({
        action: r.action,
        count: r._count._all,
      })),
    };
  }
}
