import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QStashService } from './qstash.service';
import {
  OrderPlacedEvent,
  StockLowEvent,
  OrderReadyEvent,
  DeliveryUpdatedEvent,
  TaskBlockedEvent,
} from './events/notification-events';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly qstash: QStashService) {}

  @OnEvent('order.placed')
  async handleOrderPlaced(payload: OrderPlacedEvent) {
    try {
      await this.qstash.publish('notify-new-order', payload as any);
    } catch (error) {
      this.logger.warn('Failed to dispatch order.placed notification', String(error));
    }
  }

  @OnEvent('order.ready')
  async handleOrderReady(payload: OrderReadyEvent) {
    try {
      await this.qstash.publish('notify-order-ready', payload as any);
    } catch (error) {
      this.logger.warn('Failed to dispatch order.ready notification', String(error));
    }
  }

  @OnEvent('delivery.updated')
  async handleDeliveryUpdated(payload: DeliveryUpdatedEvent) {
    try {
      await this.qstash.publish('notify-delivery-update', payload as any);
    } catch (error) {
      this.logger.warn('Failed to dispatch delivery.updated notification', String(error));
    }
  }

  @OnEvent('stock.low')
  async handleStockLow(payload: StockLowEvent) {
    try {
      await this.qstash.publish('notify-low-stock', payload as any);
    } catch (error) {
      this.logger.warn('Failed to dispatch stock.low notification', String(error));
    }
  }

  @OnEvent('task.blocked')
  async handleTaskBlocked(payload: TaskBlockedEvent) {
    try {
      await this.qstash.publish('notify-task-blocked', {
        userId: payload.ownerUserId,
        taskId: payload.taskId,
        taskName: payload.taskTitle,
        reason: payload.blockedReason,
      });
    } catch (error) {
      this.logger.warn('Failed to dispatch task.blocked notification', String(error));
    }
  }
}
