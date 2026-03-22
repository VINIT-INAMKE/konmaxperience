import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
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

@Processor('notifications')
export class NotificationsWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationsWorker.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'notify-task-due':
        await this.handleTaskDue(job);
        break;
      case 'notify-task-blocked':
        await this.handleTaskBlocked(job);
        break;
      case 'notify-approval-pending':
        await this.handleApprovalPending(job);
        break;
      case 'notify-low-stock':
        await this.handleLowStock(job);
        break;
      case 'notify-new-order':
        await this.handleNewOrder(job);
        break;
      case 'notify-order-ready':
        await this.handleOrderReady(job);
        break;
      case 'notify-delivery-update':
        await this.handleDeliveryUpdate(job);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleTaskDue(job: Job): Promise<void> {
    try {
      const { userId, taskId, taskName, questName, hours } = job.data;
      const shouldSend = await this.notifications.shouldNotify(
        userId,
        'task_due',
        taskId,
        24,
      );
      if (!shouldSend) return;

      const notification = await this.notifications.create({
        user_id: userId,
        type: 'task_due',
        title: `Task due in ${hours}h`,
        body: `${taskName} in ${questName} is due soon.`,
        link_url: `/tasks/${taskId}`,
        reference_id: taskId,
        reference_type: 'task',
      });

      await this.sendCriticalEmail(notification.id, userId, notification.title, notification.body);
    } catch (error) {
      this.logger.error(
        `Failed to process notify-task-due job ${job.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleTaskBlocked(job: Job): Promise<void> {
    try {
      const { userId, taskId, taskName, reason } = job.data;

      const notification = await this.notifications.create({
        user_id: userId,
        type: 'task_blocked',
        title: 'Task blocked',
        body: `${taskName} is blocked: ${reason || 'No reason given'}.`,
        link_url: `/tasks/${taskId}`,
        reference_id: taskId,
        reference_type: 'task',
      });

      await this.sendCriticalEmail(notification.id, userId, notification.title, notification.body);
    } catch (error) {
      this.logger.error(
        `Failed to process notify-task-blocked job ${job.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleApprovalPending(job: Job): Promise<void> {
    try {
      const { approvalId, taskName, hours } = job.data;

      // Get all FOUNDER_ADMIN users with email + name in a single query (avoids per-admin fetch in sendCriticalEmail)
      const admins = await this.prisma.user.findMany({
        where: { status: 'active', role: { code: 'FOUNDER_ADMIN' } },
        select: { id: true, email: true, name: true },
      });

      // Batch check cooldowns: fetch last notification per admin for this approval in one query
      const recentNotifications = await this.prisma.notification.findMany({
        where: {
          user_id: { in: admins.map((a) => a.id) },
          type: 'approval_pending',
          reference_id: approvalId,
        },
        orderBy: { created_at: 'desc' },
        select: { user_id: true, created_at: true },
      });

      // Build a map of userId -> last notification time
      const lastNotifMap = new Map<string, Date>();
      for (const n of recentNotifications) {
        if (!lastNotifMap.has(n.user_id)) {
          lastNotifMap.set(n.user_id, n.created_at);
        }
      }

      const title = `Approval waiting ${hours}h`;
      const body = `${taskName} evidence has been pending approval for over 24 hours.`;

      // Process eligible admins in parallel
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
            type: 'approval_pending',
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
        `Failed to process notify-approval-pending job ${job.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleLowStock(job: Job): Promise<void> {
    try {
      const { ingredientId, ingredientName, currentQty, minQty, unit } =
        job.data;

      // Fetch users with email + name to avoid per-user lookup in sendCriticalEmail
      const users = await this.prisma.user.findMany({
        where: {
          status: 'active',
          role: { permissions: { has: 'MANAGE_PROCUREMENT' } },
        },
        select: { id: true, email: true, name: true },
      });

      // Batch check cooldowns in one query
      const recentNotifications = await this.prisma.notification.findMany({
        where: {
          user_id: { in: users.map((u) => u.id) },
          type: 'low_stock',
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
            type: 'low_stock',
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
        `Failed to process notify-low-stock job ${job.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleNewOrder(job: Job): Promise<void> {
    try {
      const { orderId, channel, itemCount } = job.data;

      const users = await this.notifications.getUsersByPermission(
        'MANAGE_KITCHEN',
      );

      const title = `New order #${orderId.slice(-6).toUpperCase()}`;
      const body = `${channel} order placed. ${itemCount} item(s).`;

      // Create all notifications in parallel
      await Promise.all(
        users.map((user) =>
          this.notifications.create({
            user_id: user.id,
            type: 'new_order',
            title,
            body,
            link_url: '/operations/kitchen/kds',
            reference_id: orderId,
            reference_type: 'order',
          }),
        ),
      );
      // No email for new orders
    } catch (error) {
      this.logger.error(
        `Failed to process notify-new-order job ${job.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleOrderReady(job: Job): Promise<void> {
    try {
      const { orderId, channel } = job.data;

      const actionMap: Record<string, string> = {
        dine_in: 'serving',
        takeaway: 'pickup',
        delivery: 'dispatch',
      };
      const action = actionMap[channel] || 'serving';

      const users = await this.notifications.getUsersByPermission(
        'MANAGE_POS',
      );

      const title = `Order #${orderId.slice(-6).toUpperCase()} ready`;
      const body = `${channel} order is ready for ${action}.`;

      // Create all notifications in parallel
      await Promise.all(
        users.map((user) =>
          this.notifications.create({
            user_id: user.id,
            type: 'order_ready',
            title,
            body,
            link_url: '/pos/orders',
            reference_id: orderId,
            reference_type: 'order',
          }),
        ),
      );
      // No email for order ready
    } catch (error) {
      this.logger.error(
        `Failed to process notify-order-ready job ${job.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleDeliveryUpdate(job: Job): Promise<void> {
    try {
      const { orderId, deliveryStatus, deliveryAddress, createdBy } = job.data;

      await this.notifications.create({
        user_id: createdBy,
        type: 'delivery_update',
        title: `Delivery ${deliveryStatus}`,
        body: `Order #${orderId.slice(-6).toUpperCase()} to ${deliveryAddress || 'unknown'}: ${deliveryStatus}.`,
        link_url: '/pos/delivery',
        reference_id: orderId,
        reference_type: 'order',
      });
      // No email for delivery updates
    } catch (error) {
      this.logger.error(
        `Failed to process notify-delivery-update job ${job.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Send a critical email. Accepts either a userId (string) to look up,
   * or a pre-fetched user object { email, name } to avoid an extra DB query.
   */
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

      // Mark email as sent on the notification record
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { is_email_sent: true },
      });

      this.logger.log(`Critical email sent to ${user.email} for notification ${notificationId}`);
    } catch (error) {
      // Email failure should not block notification processing
      this.logger.error(
        `Failed to send critical email for notification ${notificationId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
