import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

@Injectable()
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async process(jobName: string, data: Record<string, any>): Promise<void> {
    switch (jobName) {
      case 'notify-task-due':
        await this.handleTaskDue(data);
        break;
      case 'notify-task-blocked':
        await this.handleTaskBlocked(data);
        break;
      case 'notify-approval-pending':
        await this.handleApprovalPending(data);
        break;
      case 'notify-low-stock':
        await this.handleLowStock(data);
        break;
      case 'notify-new-order':
        await this.handleNewOrder(data);
        break;
      case 'notify-order-ready':
        await this.handleOrderReady(data);
        break;
      case 'notify-delivery-update':
        await this.handleDeliveryUpdate(data);
        break;
      default:
        this.logger.warn(`Unknown job name: ${jobName}`);
    }
  }

  private async handleTaskDue(data: Record<string, any>): Promise<void> {
    try {
      const { userId, taskId, taskName, questName, hours } = data;
      const shouldSend = await this.notifications.shouldNotify(
        userId,
        NotificationType.task_due,
        taskId,
        24,
      );
      if (!shouldSend) return;

      const notification = await this.notifications.create({
        user_id: userId,
        type: NotificationType.task_due,
        title: `Task due in ${hours}h`,
        body: `${taskName} in ${questName} is due soon.`,
        link_url: `/tasks/${taskId}`,
        reference_id: taskId,
        reference_type: 'task',
      });

      await this.sendCriticalEmail(notification.id, userId, notification.title, notification.body);
    } catch (error) {
      this.logger.error(
        'Failed to process notify-task-due',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleTaskBlocked(data: Record<string, any>): Promise<void> {
    try {
      const { userId, taskId, taskName, reason } = data;

      const notification = await this.notifications.create({
        user_id: userId,
        type: NotificationType.task_blocked,
        title: 'Task blocked',
        body: `${taskName} is blocked: ${reason || 'No reason given'}.`,
        link_url: `/tasks/${taskId}`,
        reference_id: taskId,
        reference_type: 'task',
      });

      await this.sendCriticalEmail(notification.id, userId, notification.title, notification.body);
    } catch (error) {
      this.logger.error(
        'Failed to process notify-task-blocked',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleApprovalPending(data: Record<string, any>): Promise<void> {
    try {
      const { approvalId, taskName, hours } = data;

      const admins = await this.prisma.user.findMany({
        where: { status: 'active', role: { code: 'FOUNDER_ADMIN' } },
        select: { id: true, email: true, name: true },
      });

      const recentNotifications = await this.prisma.notification.findMany({
        where: {
          user_id: { in: admins.map((a) => a.id) },
          type: NotificationType.approval_pending,
          reference_id: approvalId,
        },
        orderBy: { created_at: 'desc' },
        select: { user_id: true, created_at: true },
      });

      const lastNotifMap = new Map<string, Date>();
      for (const n of recentNotifications) {
        if (!lastNotifMap.has(n.user_id)) {
          lastNotifMap.set(n.user_id, n.created_at);
        }
      }

      const title = `Approval waiting ${hours}h`;
      const body = `${taskName} evidence has been pending approval for over 24 hours.`;

      const eligibleAdmins = admins.filter((admin) => {
        const lastSent = lastNotifMap.get(admin.id);
        if (!lastSent) return true;
        const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
        return hoursSince >= 24;
      });

      await Promise.all(
        eligibleAdmins.map(async (admin) => {
          const notification = await this.notifications.create({
            user_id: admin.id,
            type: NotificationType.approval_pending,
            title,
            body,
            link_url: '/approvals',
            reference_id: approvalId,
            reference_type: 'approval',
          });

          await this.sendCriticalEmail(notification.id, admin, title, body);
        }),
      );
    } catch (error) {
      this.logger.error(
        'Failed to process notify-approval-pending',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleLowStock(data: Record<string, any>): Promise<void> {
    try {
      const { ingredientId, ingredientName, currentQty, minQty, unit } = data;

      const users = await this.prisma.user.findMany({
        where: {
          status: 'active',
          role: { permissions: { has: 'MANAGE_PROCUREMENT' } },
        },
        select: { id: true, email: true, name: true },
      });

      const recentNotifications = await this.prisma.notification.findMany({
        where: {
          user_id: { in: users.map((u) => u.id) },
          type: NotificationType.low_stock,
          reference_id: ingredientId,
        },
        orderBy: { created_at: 'desc' },
        select: { user_id: true, created_at: true },
      });

      const lastNotifMap = new Map<string, Date>();
      for (const n of recentNotifications) {
        if (!lastNotifMap.has(n.user_id)) {
          lastNotifMap.set(n.user_id, n.created_at);
        }
      }

      const title = `Low stock: ${ingredientName}`;
      const body = `${ingredientName} is at ${currentQty} ${unit}, below minimum level of ${minQty} ${unit}.`;

      const eligibleUsers = users.filter((user) => {
        const lastSent = lastNotifMap.get(user.id);
        if (!lastSent) return true;
        const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
        return hoursSince >= 4;
      });

      await Promise.all(
        eligibleUsers.map(async (user) => {
          const notification = await this.notifications.create({
            user_id: user.id,
            type: NotificationType.low_stock,
            title,
            body,
            link_url: '/operations/inventory',
            reference_id: ingredientId,
            reference_type: 'ingredient',
          });

          await this.sendCriticalEmail(notification.id, user, title, body);
        }),
      );
    } catch (error) {
      this.logger.error(
        'Failed to process notify-low-stock',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleNewOrder(data: Record<string, any>): Promise<void> {
    try {
      const { orderId, channel, itemCount } = data;

      const users = await this.notifications.getUsersByPermission('MANAGE_KITCHEN');

      const title = `New order #${orderId.slice(-6).toUpperCase()}`;
      const body = `${channel} order placed. ${itemCount} item(s).`;

      await Promise.all(
        users.map((user) =>
          this.notifications.create({
            user_id: user.id,
            type: NotificationType.new_order,
            title,
            body,
            link_url: '/operations/kitchen/kds',
            reference_id: orderId,
            reference_type: 'order',
          }),
        ),
      );
    } catch (error) {
      this.logger.error(
        'Failed to process notify-new-order',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleOrderReady(data: Record<string, any>): Promise<void> {
    try {
      const { orderId, channel } = data;

      const actionMap: Record<string, string> = {
        dine_in: 'serving',
        takeaway: 'pickup',
        delivery: 'dispatch',
      };
      const action = actionMap[channel] || 'serving';

      const users = await this.notifications.getUsersByPermission('MANAGE_POS');

      const title = `Order #${orderId.slice(-6).toUpperCase()} ready`;
      const body = `${channel} order is ready for ${action}.`;

      await Promise.all(
        users.map((user) =>
          this.notifications.create({
            user_id: user.id,
            type: NotificationType.order_ready,
            title,
            body,
            link_url: '/pos/orders',
            reference_id: orderId,
            reference_type: 'order',
          }),
        ),
      );
    } catch (error) {
      this.logger.error(
        'Failed to process notify-order-ready',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleDeliveryUpdate(data: Record<string, any>): Promise<void> {
    try {
      const { orderId, deliveryStatus, deliveryAddress, createdBy } = data;

      await this.notifications.create({
        user_id: createdBy,
        type: NotificationType.delivery_update,
        title: `Delivery ${deliveryStatus}`,
        body: `Order #${orderId.slice(-6).toUpperCase()} to ${deliveryAddress || 'unknown'}: ${deliveryStatus}.`,
        link_url: '/pos/delivery',
        reference_id: orderId,
        reference_type: 'order',
      });
    } catch (error) {
      this.logger.error(
        'Failed to process notify-delivery-update',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async sendCriticalEmail(
    notificationId: string,
    userOrId: string | { email: string; name: string },
    subject: string,
    body: string,
  ): Promise<void> {
    try {
      let user: { email: string; name: string } | null;
      if (typeof userOrId === 'string') {
        user = await this.prisma.user.findUnique({
          where: { id: userOrId },
          select: { email: true, name: true },
        });
      } else {
        user = userOrId;
      }
      if (!user) return;

      const safeName = escapeHtml(user.name);
      const safeBody = escapeHtml(body);
      const frontendUrl = this.emailService.publicFrontendUrl;

      await this.emailService.sendHtml(
        { email: user.email, name: user.name },
        `[Konma] ${subject}`,
        `<p>Hi ${safeName},</p>` +
          `<p>${safeBody}</p>` +
          `<p><a href="${frontendUrl}">Open Konma Xperience</a></p>` +
          `<p>-- Konma Xperience Team</p>`,
        `Hi ${user.name},\n\n${body}\n\n` +
          `Open Konma Xperience: ${frontendUrl}\n\n` +
          `-- Konma Xperience Team`,
      );

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { is_email_sent: true },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send critical email for notification ${notificationId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
