'use client';

/**
 * Every read the account area makes, in one place.
 *
 * The keys are namespaced under `['account', …]` so a sign-out can drop the
 * whole subtree with one `removeQueries({ queryKey: ['account'] })` — leaving a
 * previous customer's orders in the cache for the next person to sign in on the
 * same device would be a real disclosure, not a cosmetic bug.
 *
 * Each hook takes `enabled` from the caller rather than reading the session
 * itself: `AccountShell` has already resolved it, and a query that fires before
 * the guard settles spends a `401` for nothing.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import type { LoyaltySummary } from '@/lib/types/checkout';
import type { CustomerAddress, CustomerOrder } from '@/lib/types/marketplace';
import type { CustomerReview, PendingReview } from '@/lib/types/reviews';

export const accountKeys = {
  all: ['account'] as const,
  orders: () => ['account', 'orders'] as const,
  order: (id: string) => ['account', 'orders', id] as const,
  addresses: () => ['account', 'addresses'] as const,
  loyalty: () => ['account', 'loyalty'] as const,
  reviews: () => ['account', 'reviews'] as const,
  pendingReviews: () => ['account', 'reviews', 'pending'] as const,
};

export function useAccountOrders(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.orders(),
    queryFn: () => apiClient.get<CustomerOrder[]>('/customer/orders'),
    enabled,
  });
}

export function useAccountOrder(id: string, enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.order(id),
    queryFn: () => apiClient.get<CustomerOrder>(`/customer/orders/${id}`),
    enabled: enabled && Boolean(id),
  });
}

export function useAccountAddresses(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.addresses(),
    queryFn: () => apiClient.get<CustomerAddress[]>('/customer/addresses'),
    enabled,
  });
}

export function useAccountLoyalty(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.loyalty(),
    queryFn: () => apiClient.get<LoyaltySummary>('/customer/loyalty'),
    enabled,
  });
}

export function useAccountReviews(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.reviews(),
    queryFn: () => apiClient.get<CustomerReview[]>('/customer/reviews'),
    enabled,
  });
}

export function usePendingReviews(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.pendingReviews(),
    queryFn: () => apiClient.get<PendingReview[]>('/customer/reviews/pending'),
    enabled,
  });
}
