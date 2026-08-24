'use client';

import Link from 'next/link';
import { ChevronRight, Sparkles, Star } from 'lucide-react';

import { AccountShell } from '@/components/storefront/account/AccountShell';
import { MarketingOptInToggle } from '@/components/storefront/account/MarketingOptInToggle';
import { OrderHistoryList } from '@/components/storefront/account/OrderHistoryList';
import {
  useAccountLoyalty,
  useAccountOrders,
  usePendingReviews,
} from '@/components/storefront/account/account-queries';
import { formatCurrency, loyaltyValue } from '@/lib/format/currency';
import { LOYALTY_TIER_LABELS } from '@/lib/types/checkout';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

/**
 * The account overview — the answer to "what is going on with my account?"
 * without making anyone click into five tabs to assemble it.
 *
 * Every read here is the same query the dedicated route uses, keyed identically,
 * so opening Orders after landing here is instant and costs no second request.
 */
export default function AccountOverviewPage() {
  const { customer, isResolved } = useCustomerAuth();
  const enabled = isResolved && Boolean(customer);

  const orders = useAccountOrders(enabled);
  const loyalty = useAccountLoyalty(enabled);
  const pending = usePendingReviews(enabled);

  const pendingCount = pending.data?.length ?? 0;

  return (
    <AccountShell
      title={customer?.name?.trim() || 'Your account'}
      description={customer ? `Signed in as +91 ${customer.phone}` : undefined}
    >
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/account/loyalty"
            className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <Sparkles className="size-3.5 text-gold-text" aria-hidden="true" />
              Loyalty
            </p>
            {loyalty.data ? (
              <>
                <p className="pt-1 text-2xl font-semibold tabular-nums text-ink-strong">
                  {loyalty.data.points_balance.toLocaleString('en-IN')}
                  <span className="pl-1 text-sm font-normal text-ink-muted">pts</span>
                </p>
                <p className="text-xs text-ink-muted">
                  {LOYALTY_TIER_LABELS[loyalty.data.tier]} ·{' '}
                  {formatCurrency(
                    loyaltyValue(
                      loyalty.data.points_balance,
                      loyalty.data.redeem_value_per_point,
                    ),
                  )}{' '}
                  to spend
                </p>
              </>
            ) : (
              <p className="pt-2 text-sm text-ink-faint">
                {loyalty.isError ? 'Unavailable right now' : 'Loading…'}
              </p>
            )}
          </Link>

          <Link
            href="/account/reviews"
            className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <Star className="size-3.5" aria-hidden="true" />
              Reviews
            </p>
            <p className="pt-1 text-2xl font-semibold tabular-nums text-ink-strong">
              {pending.isPending ? '—' : pendingCount}
            </p>
            <p className="text-xs text-ink-muted">
              {pendingCount === 0
                ? 'Nothing waiting on you'
                : `${pendingCount === 1 ? 'item is' : 'items are'} waiting for a review`}
            </p>
          </Link>
        </div>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold text-ink-strong">Recent orders</h2>
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
            >
              All orders
              <ChevronRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
          <OrderHistoryList
            orders={orders.data}
            isPending={orders.isPending}
            error={orders.error}
            onRetry={() => void orders.refetch()}
            limit={2}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink-strong">Preferences</h2>
          <MarketingOptInToggle />
        </section>
      </div>
    </AccountShell>
  );
}
