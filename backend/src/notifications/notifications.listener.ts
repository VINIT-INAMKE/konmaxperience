import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QStashService } from './qstash.service';
import type { DomainEventPayloads } from '../common/events/domain-events';
import { DomainEvent } from '../common/events/domain-events';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly qstash: QStashService) {}

  @OnEvent(DomainEvent.ORDER_PLACED)
  async handleOrderPlaced(payload: DomainEventPayloads['order.placed']) {
    try {
      await this.qstash.publish('notify-new-order', payload as any);
    } catch (error) {
      this.logger.warn(
        'Failed to dispatch order.placed notification',
        String(error),
      );
    }
  }

  @OnEvent(DomainEvent.ORDER_READY)
  async handleOrderReady(payload: DomainEventPayloads['order.ready']) {
    try {
      await this.qstash.publish('notify-order-ready', payload as any);
    } catch (error) {
      this.logger.warn(
        'Failed to dispatch order.ready notification',
        String(error),
      );
    }
  }

  @OnEvent(DomainEvent.DELIVERY_UPDATED)
  async handleDeliveryUpdated(
    payload: DomainEventPayloads['delivery.updated'],
  ) {
    try {
      await this.qstash.publish('notify-delivery-update', payload as any);
    } catch (error) {
      this.logger.warn(
        'Failed to dispatch delivery.updated notification',
        String(error),
      );
    }
  }

  @OnEvent(DomainEvent.STOCK_LOW)
  async handleStockLow(payload: DomainEventPayloads['stock.low']) {
    try {
      await this.qstash.publish('notify-low-stock', payload as any);
    } catch (error) {
      this.logger.warn(
        'Failed to dispatch stock.low notification',
        String(error),
      );
    }
  }

  @OnEvent(DomainEvent.TASK_BLOCKED)
  async handleTaskBlocked(payload: DomainEventPayloads['task.blocked']) {
    try {
      await this.qstash.publish('notify-task-blocked', {
        userId: payload.ownerUserId,
        taskId: payload.taskId,
        taskName: payload.taskTitle,
        reason: payload.blockedReason,
      });
    } catch (error) {
      this.logger.warn(
        'Failed to dispatch task.blocked notification',
        String(error),
      );
    }
  }
}
