import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    link_url?: string;
    reference_id?: string;
    reference_type?: string;
    is_email_sent?: boolean;
  }) {
    return this.prisma.notification.create({ data });
  }

  async findForUser(userId: string, query: NotificationQueryDto) {
    const where: any = { user_id: userId };
    if (query.type) {
      where.type = { in: query.type.split(',') };
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
    type: string,
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
