import { NotificationsListener } from '../notifications.listener';

describe('NotificationsListener', () => {
  let listener: NotificationsListener;
  let mockQueue: any;

  beforeEach(() => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };
    listener = new NotificationsListener(mockQueue);
  });

  describe('handleOrderPlaced', () => {
    it('should enqueue notify-new-order with payload', async () => {
      const payload = {
        orderId: 'ord-1',
        channel: 'dine_in',
        itemCount: 3,
        total: '250.00',
        createdBy: 'user-1',
      };

      await listener.handleOrderPlaced(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'notify-new-order',
        payload,
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }),
      );
    });
  });

  describe('handleOrderReady', () => {
    it('should enqueue notify-order-ready with payload', async () => {
      const payload = {
        orderId: 'ord-2',
        channel: 'takeaway',
        createdBy: 'user-2',
      };

      await listener.handleOrderReady(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'notify-order-ready',
        payload,
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('handleDeliveryUpdated', () => {
    it('should enqueue notify-delivery-update with payload', async () => {
      const payload = {
        orderId: 'ord-3',
        deliveryStatus: 'picked_up',
        deliveryAddress: '123 Main St',
        createdBy: 'user-3',
      };

      await listener.handleDeliveryUpdated(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'notify-delivery-update',
        payload,
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('handleStockLow', () => {
    it('should enqueue notify-low-stock with payload', async () => {
      const payload = {
        ingredientId: 'ing-1',
        ingredientName: 'Salt',
        currentQty: 2,
        minQty: 10,
        unit: 'kg',
        zoneId: 'zone-f',
      };

      await listener.handleStockLow(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'notify-low-stock',
        payload,
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('handleTaskBlocked', () => {
    it('should enqueue notify-task-blocked with payload', async () => {
      const payload = {
        taskId: 'task-1',
        taskTitle: 'Fix widget',
        ownerUserId: 'user-1',
        blockedReason: 'Waiting for vendor',
      };

      await listener.handleTaskBlocked(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'notify-task-blocked',
        payload,
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('failure isolation', () => {
    it('should not re-throw when queue.add fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Redis down'));

      await expect(
        listener.handleOrderPlaced({
          orderId: 'ord-fail',
          channel: 'delivery',
          itemCount: 1,
          total: '100',
          createdBy: 'user-x',
        }),
      ).resolves.toBeUndefined();
    });

    it('should not re-throw when queue.add fails for stock.low', async () => {
      mockQueue.add.mockRejectedValue(new Error('Redis timeout'));

      await expect(
        listener.handleStockLow({
          ingredientId: 'ing-2',
          ingredientName: 'Flour',
          currentQty: 1,
          minQty: 5,
          unit: 'kg',
          zoneId: 'zone-a',
        }),
      ).resolves.toBeUndefined();
    });

    it('should not re-throw when queue.add fails for task.blocked', async () => {
      mockQueue.add.mockRejectedValue(new Error('Connection refused'));

      await expect(
        listener.handleTaskBlocked({
          taskId: 'task-fail',
          taskTitle: 'Some task',
          ownerUserId: 'user-fail',
          blockedReason: null,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
