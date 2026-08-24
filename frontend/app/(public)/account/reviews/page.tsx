'use client';

import { AccountShell } from '@/components/storefront/account/AccountShell';
import { CustomerReviewList } from '@/components/storefront/account/CustomerReviewList';
import { PendingReviewList } from '@/components/storefront/account/PendingReviewList';
import {
  useAccountReviews,
  usePendingReviews,
} from '@/components/storefront/account/account-queries';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { apiErrorMessage } from '@/lib/api-client';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

/**
 * `ACCT-02` — two sections, in the order they matter.
 *
 * **Pending** comes first because it is the only part with something to do:
 * delivered goods and attended workshops that have not been reviewed. **Written**
 * follows, with each review's moderation state stated plainly rather than
 * flattered — a `pending` review is not yet visible to anyone else and saying so
 * is the difference between a wait and a mystery.
 */
export default function AccountReviewsPage() {
  const { customer, isResolved } = useCustomerAuth();
  const enabled = isResolved && Boolean(customer);

  const pending = usePendingReviews(enabled);
  const written = useAccountReviews(enabled);

  return (
    <AccountShell
      title="Reviews"
      description="Tell other people what something was actually like."
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink-strong">
            Waiting for your review
            {pending.data && pending.data.length > 0 ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                {pending.data.length}
              </span>
            ) : null}
          </h2>
          {pending.isPending ? (
            <StorefrontSkeleton variant="list" count={2} />
          ) : pending.error ? (
            <StorefrontError
              density="inline"
              title="We could not load your review invitations"
              description={apiErrorMessage(pending.error, 'The pending list did not come back.')}
              onRetry={() => void pending.refetch()}
            />
          ) : (
            <PendingReviewList pending={pending.data ?? []} />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink-strong">
            Reviews you have written
          </h2>
          {written.isPending ? (
            <StorefrontSkeleton variant="list" count={2} />
          ) : written.error ? (
            <StorefrontError
              density="inline"
              title="We could not load your reviews"
              description={apiErrorMessage(written.error, 'The review list did not come back.')}
              onRetry={() => void written.refetch()}
            />
          ) : (
            <CustomerReviewList reviews={written.data ?? []} />
          )}
        </section>
      </div>
    </AccountShell>
  );
}
