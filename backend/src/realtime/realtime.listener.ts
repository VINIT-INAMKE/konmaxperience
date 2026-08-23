import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeService } from './realtime.service';
import { REALTIME_EVENTS } from './realtime.channels';
import { DomainEvent } from '../common/events/domain-events';
import type { DomainEventPayload } from '../common/events/domain-events';

/**
 * Realtime fan-out driven by the SPEC §4.1 domain events. Both sources below
 * already emit a typed event *after* their transaction commits, so subscribing
 * here keeps the Pusher push in the realtime module rather than threading
 * `RealtimeService` through the order and approval write paths.
 */
@Injectable()
export class RealtimeListener {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * A new order lands on both boards: the KDS screen shows its scratch items and
   * Pick & Pack the rest. Neither can tell from the payload which applies, so
   * each client refetches its own view.
   */
  @OnEvent(DomainEvent.ORDER_PLACED)
  handleOrderPlaced(payload: DomainEventPayload<'order.placed'>): void {
    void this.realtime.emit('private-kds', REALTIME_EVENTS.KDS_ORDER_NEW, {
      order_id: payload.orderId,
    });
    void this.realtime.emit(
      'private-pick-pack',
      REALTIME_EVENTS.PICK_PACK_ORDER_NEW,
      { order_id: payload.orderId },
    );
  }

  /**
   * Covers `decide`, `approve` and `override` in one place — all three emit
   * `approval.decided`. The payload deliberately carries no count: the client
   * refetches, so the badge can never be stale or leak another role's number.
   */
  @OnEvent(DomainEvent.APPROVAL_DECIDED)
  handleApprovalDecided(payload: DomainEventPayload<'approval.decided'>): void {
    void this.realtime.emit(
      'private-approvals',
      REALTIME_EVENTS.APPROVALS_COUNT_CHANGED,
      { at: payload.occurred_at },
    );
  }
}
