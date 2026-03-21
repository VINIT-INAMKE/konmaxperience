import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Processor('notifications')
export class NotificationsWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationsWorker.name);
  private mailerSend: MailerSend;
  private fromEmail: string;
  private frontendUrl: string;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
    const apiKey = this.configService.get<string>('MAILERSEND_API_KEY') || '';
    this.mailerSend = new MailerSend({ apiKey });
    this.fromEmail =
      this.configService.get<string>('MAILERSEND_FROM_EMAIL') ||
      'noreply@konmaxperience.com';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
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

      // Get all FOUNDER_ADMIN users
      const admins = await this.prisma.user.findMany({
        where: { status: 'active', role: { code: 'FOUNDER_ADMIN' } },
      });

      for (const admin of admins) {
        const shouldSend = await this.notifications.shouldNotify(
          admin.id,
          'approval_pending',
          approvalId,
          24,
        );
        if (!shouldSend) continue;

        const notification = await this.notifications.create({
          user_id: admin.id,
          type: 'approval_pending',
          title: `Approval waiting ${hours}h`,
          body: `${taskName} evidence has been pending approval for over 24 hours.`,
          link_url: '/approvals',
          reference_id: approvalId,
          reference_type: 'approval',
        });

        await this.sendCriticalEmail(notification.id, admin.id, notification.title, notification.body);
      }
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

      const users = await this.notifications.getUsersByPermission(
        'MANAGE_PROCUREMENT',
      );

      for (const user of users) {
        const shouldSend = await this.notifications.shouldNotify(
          user.id,
          'low_stock',
          ingredientId,
          4,
        );
        if (!shouldSend) continue;

        const notification = await this.notifications.create({
          user_id: user.id,
          type: 'low_stock',
          title: `Low stock: ${ingredientName}`,
          body: `${ingredientName} is at ${currentQty} ${unit}, below minimum level of ${minQty} ${unit}.`,
          link_url: '/operations/inventory',
          reference_id: ingredientId,
          reference_type: 'ingredient',
        });

        await this.sendCriticalEmail(notification.id, user.id, notification.title, notification.body);
      }
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

      for (const user of users) {
        await this.notifications.create({
          user_id: user.id,
          type: 'new_order',
          title: `New order #${orderId.slice(-6).toUpperCase()}`,
          body: `${channel} order placed. ${itemCount} item(s).`,
          link_url: '/operations/kitchen/kds',
          reference_id: orderId,
          reference_type: 'order',
        });
      }
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

      for (const user of users) {
        await this.notifications.create({
          user_id: user.id,
          type: 'order_ready',
          title: `Order #${orderId.slice(-6).toUpperCase()} ready`,
          body: `${channel} order is ready for ${action}.`,
          link_url: '/pos/orders',
          reference_id: orderId,
          reference_type: 'order',
        });
      }
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

  private async sendCriticalEmail(
    notificationId: string,
    userId: string,
    subject: string,
    body: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (!user) return;

      const sentFrom = new Sender(this.fromEmail, 'Konma Xperience');
      const recipients = [new Recipient(user.email, user.name)];

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(`[Konma] ${subject}`)
        .setHtml(
          `<p>Hi ${user.name},</p>` +
            `<p>${body}</p>` +
            `<p><a href="${this.frontendUrl}">Open Konma Xperience</a></p>` +
            `<p>-- Konma Xperience Team</p>`,
        )
        .setText(
          `Hi ${user.name},\n\n${body}\n\n` +
            `Open Konma Xperience: ${this.frontendUrl}\n\n` +
            `-- Konma Xperience Team`,
        );

      await this.mailerSend.email.send(emailParams);

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
