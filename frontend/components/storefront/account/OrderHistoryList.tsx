'use client';

import { Package } from 'lucide-react';

import { OrderHistoryCard } from '@/components/storefront/account/OrderHistoryCard';
import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { apiErrorMessage } from '@/lib/api-client';
import type { CustomerOrder } from '@/lib/types/marketplace';

/**
 * The order history (`ACCT-01`).
 *
 * `GET /customer/orders` returns **every** channel and every fulfilment type in
 * one newest-first list, and this component keeps it that way: no channel
 * filter, no tabs. A customer who bought a coffee in the villa, a jar of pickle
 * by post and a workshop seat has one purchase history, and splitting it into
 * three would make "where is my order" harder to answer, not easier.
 */
export interface OrderHistoryListProps {
  orders: CustomerOrder[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry?: () => void;
  /** Caps the list — the account overview shows the two most recent. */
  limit?: number;
}

export function OrderHistoryList({
  orders,
  isPending,
  error,
  onRetry,
  limit,
}: OrderHistoryListProps) {
  if (isPending) {
    return <StorefrontSkeleton variant="list" count={limit ?? 3} />;
  }

  if (error) {
    return (
      <StorefrontError
        density="inline"
        title="We could not load your orders"
        description={apiErrorMessage(error, 'The order history did not come back.')}
        onRetry={onRetry}
      />
    );
  }

  const rows = limit ? (orders ?? []).slice(0, limit) : (orders ?? []);

  if (rows.length === 0) {
    return (
      <StorefrontEmpty
        density="inline"
        icon={Package}
        title="No orders yet"
        description="Everything you buy — in the villa, by post or a seat at a workshop — shows up here."
        action={{ label: 'Start shopping', href: '/shop' }}
        secondaryAction={{ label: 'Browse experiences', href: '/experiences' }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((order) => (
        <OrderHistoryCard key={order.id} order={order} compact={Boolean(limit)} />
      ))}
    </div>
  );
}
