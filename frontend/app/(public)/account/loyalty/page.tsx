'use client';

import { AccountShell } from '@/components/storefront/account/AccountShell';
import { LoyaltyLedger } from '@/components/storefront/account/LoyaltyLedger';
import { LoyaltyPanel } from '@/components/storefront/account/LoyaltyPanel';
import { useAccountLoyalty } from '@/components/storefront/account/account-queries';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { apiErrorMessage } from '@/lib/api-client';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

/**
 * `GET /customer/loyalty` in one page: balance, tier, the gap to the next tier
 * and the last 50 ledger rows. One request — the endpoint is deliberately a
 * whole-surface read, so there is nothing to stitch together here.
 */
export default function AccountLoyaltyPage() {
  const { customer, isResolved } = useCustomerAuth();
  const loyalty = useAccountLoyalty(isResolved && Boolean(customer));

  return (
    <AccountShell
      title="Loyalty"
      description="Points earn on delivery or attendance, and come off the bill at checkout."
    >
      {loyalty.isPending ? (
        <StorefrontSkeleton variant="detail" />
      ) : loyalty.error ? (
        <StorefrontError
          density="inline"
          title="We could not load your points"
          description={apiErrorMessage(loyalty.error, 'The loyalty account did not come back.')}
          onRetry={() => void loyalty.refetch()}
        />
      ) : loyalty.data ? (
        <div className="space-y-6">
          <LoyaltyPanel summary={loyalty.data} />
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-strong">Points activity</h2>
            <LoyaltyLedger transactions={loyalty.data.transactions} />
          </section>
        </div>
      ) : null}
    </AccountShell>
  );
}
