import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvent,
  type DomainEventPayloads,
} from '../common/events/domain-events';
import { MissionBridgeService } from './mission-bridge.service';

/**
 * SPEC §4.2 — the only `@OnEvent` subscriber in the codebase that writes.
 * One explicit decorator per event (rather than a wildcard) so the subscribed
 * set is greppable and `mission-bridge.service.spec.ts` can assert that every
 * rule marked `emitter: 'P3'` actually has a handler.
 *
 * `MissionBridgeService.apply` never rejects — every path goes through
 * `dispatchOnce`, which catches — so `void` is correct and no handler needs
 * its own try/catch.
 */
@Injectable()
export class MissionBridgeListener {
  constructor(private readonly bridge: MissionBridgeService) {}

  @OnEvent(DomainEvent.RECIPE_APPROVED)
  onRecipeApproved(p: DomainEventPayloads['recipe.approved']) {
    void this.bridge.apply(DomainEvent.RECIPE_APPROVED, p);
  }

  @OnEvent(DomainEvent.RECIPE_ARCHIVED)
  onRecipeArchived(p: DomainEventPayloads['recipe.archived']) {
    void this.bridge.apply(DomainEvent.RECIPE_ARCHIVED, p);
  }

  @OnEvent(DomainEvent.PURCHASE_ORDER_RECEIVED)
  onPurchaseOrderReceived(p: DomainEventPayloads['purchase_order.received']) {
    void this.bridge.apply(DomainEvent.PURCHASE_ORDER_RECEIVED, p);
  }

  @OnEvent(DomainEvent.VENDOR_PRICE_UPDATED)
  onVendorPriceUpdated(p: DomainEventPayloads['vendor_price.updated']) {
    void this.bridge.apply(DomainEvent.VENDOR_PRICE_UPDATED, p);
  }

  @OnEvent(DomainEvent.STOCK_LOW)
  onStockLow(p: DomainEventPayloads['stock.low']) {
    void this.bridge.apply(DomainEvent.STOCK_LOW, p);
  }

  @OnEvent(DomainEvent.PREP_BATCH_CREATED)
  onPrepBatchCreated(p: DomainEventPayloads['prep_batch.created']) {
    void this.bridge.apply(DomainEvent.PREP_BATCH_CREATED, p);
  }

  @OnEvent(DomainEvent.PREP_BATCH_DEPLETED)
  onPrepBatchDepleted(p: DomainEventPayloads['prep_batch.depleted']) {
    void this.bridge.apply(DomainEvent.PREP_BATCH_DEPLETED, p);
  }

  @OnEvent(DomainEvent.ORDER_CONFIRMED)
  onOrderConfirmed(p: DomainEventPayloads['order.confirmed']) {
    void this.bridge.apply(DomainEvent.ORDER_CONFIRMED, p);
  }

  @OnEvent(DomainEvent.ORDER_SERVED)
  onOrderServed(p: DomainEventPayloads['order.served']) {
    void this.bridge.apply(DomainEvent.ORDER_SERVED, p);
  }

  @OnEvent(DomainEvent.ORDER_DELIVERED)
  onOrderDelivered(p: DomainEventPayloads['order.delivered']) {
    void this.bridge.apply(DomainEvent.ORDER_DELIVERED, p);
  }

  @OnEvent(DomainEvent.WASTE_LOGGED)
  onWasteLogged(p: DomainEventPayloads['waste.logged']) {
    void this.bridge.apply(DomainEvent.WASTE_LOGGED, p);
  }

  @OnEvent(DomainEvent.FEEDBACK_RECEIVED)
  onFeedbackReceived(p: DomainEventPayloads['feedback.received']) {
    void this.bridge.apply(DomainEvent.FEEDBACK_RECEIVED, p);
  }

  @OnEvent(DomainEvent.PRODUCT_PUBLISHED)
  onProductPublished(p: DomainEventPayloads['product.published']) {
    void this.bridge.apply(DomainEvent.PRODUCT_PUBLISHED, p);
  }

  @OnEvent(DomainEvent.EVENT_COMPLETED)
  onEventCompleted(p: DomainEventPayloads['event.completed']) {
    void this.bridge.apply(DomainEvent.EVENT_COMPLETED, p);
  }

  @OnEvent(DomainEvent.DECISION_RESOLVED)
  onDecisionResolved(p: DomainEventPayloads['decision.resolved']) {
    void this.bridge.apply(DomainEvent.DECISION_RESOLVED, p);
  }

  @OnEvent(DomainEvent.APPROVAL_DECIDED)
  onApprovalDecided(p: DomainEventPayloads['approval.decided']) {
    void this.bridge.apply(DomainEvent.APPROVAL_DECIDED, p);
  }
}
