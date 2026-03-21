import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
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

  constructor(
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {}

  @OnEvent('order.placed')
  async handleOrderPlaced(payload: OrderPlacedEvent) {
    try {
      await this.queue.add('notify-new-order', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (error) {
      this.logger.warn(
        'Failed to enqueue order.placed notification',
        String(error),
      );
    }
  }

  @OnEvent('order.ready')
  async handleOrderReady(payload: OrderReadyEvent) {
    try {
      await this.queue.add('notify-order-ready', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (error) {
      this.logger.warn(
        'Failed to enqueue order.ready notification',
        String(error),
      );
    }
  }

  @OnEvent('delivery.updated')
  async handleDeliveryUpdated(payload: DeliveryUpdatedEvent) {
    try {
      await this.queue.add('notify-delivery-update', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (error) {
      this.logger.warn(
        'Failed to enqueue delivery.updated notification',
        String(error),
      );
    }
  }

  @OnEvent('stock.low')
  async handleStockLow(payload: StockLowEvent) {
    try {
      await this.queue.add('notify-low-stock', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (error) {
      this.logger.warn(
        'Failed to enqueue stock.low notification',
        String(error),
      );
    }
  }

  @OnEvent('task.blocked')
  async handleTaskBlocked(payload: TaskBlockedEvent) {
    try {
      await this.queue.add('notify-task-blocked', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (error) {
      this.logger.warn(
        'Failed to enqueue task.blocked notification',
        String(error),
      );
    }
  }
}
