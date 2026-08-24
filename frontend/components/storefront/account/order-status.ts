/**
 * Order status → a *meaning*, not a hue (DESIGN-02).
 *
 * Kept apart from the components so the badge on the order list, the badge on
 * the receipt and the badge on a reorder toast cannot drift into three
 * different opinions about what "dispatched" looks like.
 */

import { STATUS_BADGE } from '@/lib/status-styles';
import type { OrderStatus } from '@/lib/types/kds';

export function orderStatusBadge(status: OrderStatus): string {
  switch (status) {
    case 'delivered':
    case 'completed':
    case 'served':
      return STATUS_BADGE.good;
    case 'cancelled':
      return STATUS_BADGE.muted;
    case 'refunded':
      return STATUS_BADGE.serious;
    case 'shipped':
    case 'dispatched':
      return STATUS_BADGE.info;
    case 'preparing':
    case 'ready':
      return STATUS_BADGE.warning;
    default:
      return STATUS_BADGE.neutral;
  }
}

/**
 * Whether tracking is worth offering.
 *
 * A cancelled order has nothing to track and a `placed` one has nothing to show
 * yet beyond what the card already says, so the link is withheld rather than
 * pointing at a timeline with a single dot on it.
 */
export function isTrackable(status: OrderStatus): boolean {
  return status !== 'cancelled' && status !== 'refunded' && status !== 'placed';
}
