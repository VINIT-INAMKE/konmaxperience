import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly prisma: PrismaService,
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

  // The four per-subject jobs below route through `NotificationDispatcher`
  // (P6 decision 9): one cooldown read from `SystemSetting['notifications']`,
  // one email decision from `email_types`, and the WhatsApp leg for free. The
  // hand-rolled `lastNotifMap` loops and the hardcoded 24 h / 4 h windows they
  // used to carry are gone, as is `sendCriticalEmail` — the last writer of the
  // dropped `Notification.is_email_sent`.

  private async handleTaskDue(data: Record<string, any>): Promise<void> {
    try {
      const { userId, taskId, taskName, questName, hours } = data;

      await this.dispatcher.dispatch({
        user_id: userId,
        type: NotificationType.task_due,
        title: `Task due in ${hours}h`,
        body: `${taskName} in ${questName} is due soon.`,
        link_url: `/tasks/${taskId}`,
        reference_id: taskId,
        reference_type: 'task',
        template_ctx: { subject: taskName, hours },
      });
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

      await this.dispatcher.dispatch({
        user_id: userId,
        type: NotificationType.task_blocked,
        title: 'Task blocked',
        body: `${taskName} is blocked: ${reason || 'No reason given'}.`,
        link_url: `/tasks/${taskId}`,
        reference_id: taskId,
        reference_type: 'task',
        template_ctx: { subject: taskName, reason: reason || 'No reason given' },
      });
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

      // Keyed on the role code, not a permission — `getUsersByPermission`
      // cannot express "the founder admin" and this nudge is addressed to them.
      const admins = await this.prisma.user.findMany({
        where: { status: 'active', role: { code: 'FOUNDER_ADMIN' } },
        select: { id: true },
      });

      const title = `Approval waiting ${hours}h`;
      const body = `${taskName} evidence has been pending approval for over 24 hours.`;

      await Promise.all(
        admins.map((admin) =>
          this.dispatcher.dispatch({
            user_id: admin.id,
            type: NotificationType.approval_pending,
            title,
            body,
            link_url: '/approvals',
            reference_id: approvalId,
            reference_type: 'approval',
            template_ctx: { subject: taskName, hours },
          }),
        ),
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

      const users =
        await this.notifications.getUsersByPermission('MANAGE_PROCUREMENT');

      const title = `Low stock: ${ingredientName}`;
      const body = `${ingredientName} is at ${currentQty} ${unit}, below minimum level of ${minQty} ${unit}.`;

      await Promise.all(
        users.map((user) =>
          this.dispatcher.dispatch({
            user_id: user.id,
            type: NotificationType.low_stock,
            title,
            body,
            link_url: '/operations/inventory',
            reference_id: ingredientId,
            reference_type: 'ingredient',
            template_ctx: {
              subject: ingredientName,
              onHand: `${currentQty} ${unit}`,
              minimum: `${minQty} ${unit}`,
            },
          }),
        ),
      );
    } catch (error) {
      this.logger.error(
        'Failed to process notify-low-stock',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // The three below stay on `notifications.create`: they are per-event, not
  // per-subject, so there is no cooldown semantic to consolidate and no staff
  // WhatsApp template registered for them.

  private async handleNewOrder(data: Record<string, any>): Promise<void> {
    try {
      const { orderId, channel, itemCount } = data;

      const users =
        await this.notifications.getUsersByPermission('MANAGE_KITCHEN');

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
}
