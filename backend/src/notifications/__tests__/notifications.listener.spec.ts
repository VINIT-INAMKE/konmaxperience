import { NotificationsListener } from '../notifications.listener';
import { mockQstash } from '../../test-utils/mock-providers';

describe('NotificationsListener', () => {
  let listener: NotificationsListener;
  let qstash: ReturnType<typeof mockQstash>;

  beforeEach(() => {
    qstash = mockQstash();
    listener = new NotificationsListener(qstash as any);
  });

  it('publishes notify-new-order with the event payload', async () => {
    const payload = {
      orderId: 'ord-1',
      channel: 'dine_in',
      itemCount: 3,
      total: '250.00',
      createdBy: 'user-1',
    };

    await listener.handleOrderPlaced(payload);

    expect(qstash.publish).toHaveBeenCalledTimes(1);
    expect(qstash.publish).toHaveBeenCalledWith('notify-new-order', payload);
  });

  it('publishes notify-order-ready with the event payload', async () => {
    const payload = { orderId: 'ord-2', channel: 'takeaway', createdBy: 'user-2' };

    await listener.handleOrderReady(payload);

    expect(qstash.publish).toHaveBeenCalledTimes(1);
    expect(qstash.publish).toHaveBeenCalledWith('notify-order-ready', payload);
  });

  it('publishes notify-delivery-update with the event payload', async () => {
    const payload = {
      orderId: 'ord-3',
      deliveryStatus: 'picked_up',
      deliveryAddress: '123 Main St',
      createdBy: 'user-3',
    };

    await listener.handleDeliveryUpdated(payload);

    expect(qstash.publish).toHaveBeenCalledTimes(1);
    expect(qstash.publish).toHaveBeenCalledWith('notify-delivery-update', payload);
  });

  it('publishes notify-low-stock with the event payload', async () => {
    const payload = {
      ingredientId: 'ing-1',
      ingredientName: 'Salt',
      currentQty: 2,
      minQty: 10,
      unit: 'kg',
      zoneId: 'zone-f',
    };

    await listener.handleStockLow(payload);

    expect(qstash.publish).toHaveBeenCalledTimes(1);
    expect(qstash.publish).toHaveBeenCalledWith('notify-low-stock', payload);
  });

  it('publishes notify-task-blocked with the processor field names', async () => {
    await listener.handleTaskBlocked({
      taskId: 'task-1',
      taskTitle: 'Fix widget',
      ownerUserId: 'user-1',
      blockedReason: 'Waiting for vendor',
    });

    expect(qstash.publish).toHaveBeenCalledTimes(1);
    expect(qstash.publish).toHaveBeenCalledWith('notify-task-blocked', {
      userId: 'user-1',
      taskId: 'task-1',
      taskName: 'Fix widget',
      reason: 'Waiting for vendor',
    });
  });

  describe('failure isolation', () => {
    beforeEach(() => {
      qstash.publish.mockRejectedValue(new Error('QStash down'));
    });

    it('does not re-throw for order.placed', async () => {
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

    it('does not re-throw for order.ready', async () => {
      await expect(
        listener.handleOrderReady({ orderId: 'ord-fail', channel: 'takeaway', createdBy: 'user-x' }),
      ).resolves.toBeUndefined();
    });

    it('does not re-throw for delivery.updated', async () => {
      await expect(
        listener.handleDeliveryUpdated({
          orderId: 'ord-fail',
          deliveryStatus: 'delivered',
          deliveryAddress: null,
          createdBy: 'user-x',
        }),
      ).resolves.toBeUndefined();
    });

    it('does not re-throw for stock.low', async () => {
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

    it('does not re-throw for task.blocked', async () => {
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
