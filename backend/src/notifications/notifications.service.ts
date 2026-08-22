import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { isEnumValue } from '../common/utils/parse-enum';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    user_id: string;
    type: NotificationType;
    title: string;
    body: string;
    link_url?: string;
    reference_id?: string;
    reference_type?: string;
    is_email_sent?: boolean;
  }) {
    return this.prisma.notification.create({ data });
  }

  async broadcast(data: {
    title: string;
    body: string;
    link_url?: string;
    sent_by: string;
  }) {
    const activeUsers = await this.prisma.user.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    const notifications = activeUsers.map((user) => ({
      user_id: user.id,
      type: NotificationType.admin_notice,
      title: data.title,
      body: data.body,
      link_url: data.link_url || null,
      reference_id: data.sent_by,
      reference_type: 'admin_broadcast',
    }));

    return this.prisma.notification.createMany({ data: notifications });
  }

  async findForUser(userId: string, query: NotificationQueryDto) {
    const where: any = { user_id: userId };
    if (query.type) {
      // Unknown values are dropped rather than rejected — an unrecognised type
      // simply matches nothing, as it did when the column was a free string.
      where.type = {
        in: query.type
          .split(',')
          .map((t) => t.trim())
          .filter((t): t is NotificationType =>
            isEnumValue(NotificationType, t),
          ),
      };
    }
    if (query.is_read !== undefined) {
      where.is_read = query.is_read;
    }
    const limit = Math.min(query.limit ?? 20, 100);
    if (query.cursor) {
      return this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: 1,
        cursor: { id: query.cursor },
      });
    }
    return this.prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, user_id: userId },
      data: { is_read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
  }

  async shouldNotify(
    userId: string,
    type: NotificationType,
    referenceId: string,
    cooldownHours: number,
  ): Promise<boolean> {
    const last = await this.prisma.notification.findFirst({
      where: { user_id: userId, type, reference_id: referenceId },
      orderBy: { created_at: 'desc' },
    });
    if (!last) return true;
    const hoursSinceLast =
      (Date.now() - last.created_at.getTime()) / (1000 * 60 * 60);
    return hoursSinceLast >= cooldownHours;
  }

  async getUsersByPermission(permission: string): Promise<{ id: string }[]> {
    return this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { permissions: { has: permission } },
      },
      select: { id: true },
    });
  }
}
