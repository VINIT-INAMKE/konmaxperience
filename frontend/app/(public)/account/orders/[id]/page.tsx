'use client';

import { use } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { AccountShell } from '@/components/storefront/account/AccountShell';
import { OrderReceipt } from '@/components/storefront/account/OrderReceipt';
import {
  useAccountLoyalty,
  useAccountOrder,
} from '@/components/storefront/account/account-queries';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { apiErrorMessage, apiErrorStatus } from '@/lib/api-client';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

/**
 * One order's receipt.
 *
 * The loyalty read rides along because the receipt needs
 * `redeem_value_per_point` to split `discount_amount` into its coupon and
 * loyalty halves (P5a decision 23). It is the same cached query the loyalty page
 * uses, so this is not an extra request in practice — and the receipt degrades
 * to a single "Discount" line if it fails rather than blocking on it.
 *
 * A `404` here is a real outcome, not an error to apologise for: the order id in
 * the URL belongs to somebody else, or to nothing. `getOrderById` scopes every
 * read to the token's customer, so this page can never show another customer's
 * order however the URL was arrived at.
 */
export default function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // `params` is a promise in Next 16; `use()` unwraps it in a client component,
  // which is how `/orders/[id]/track` already reads its id.
  const { id: orderId } = use(params);
  const { customer, isResolved } = useCustomerAuth();
  const enabled = isResolved && Boolean(customer);

  const order = useAccountOrder(orderId, enabled);
  const loyalty = useAccountLoyalty(enabled);

  const notFound = apiErrorStatus(order.error) === 404;

  return (
    <AccountShell
      title="Receipt"
      action={
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-0.5 text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          All orders
        </Link>
      }
    >
      {order.isPending ? (
        <StorefrontSkeleton variant="detail" />
      ) : order.error ? (
        <StorefrontError
          density="inline"
          title={notFound ? 'We could not find that order' : 'We could not load this receipt'}
          description={
            notFound
              ? 'It may have been placed on another account, or the link is wrong.'
              : apiErrorMessage(order.error, 'The receipt did not come back.')
          }
          onRetry={notFound ? undefined : () => void order.refetch()}
          href="/account/orders"
          actionLabel="Back to orders"
        />
      ) : order.data ? (
        <OrderReceipt
          order={order.data}
          redeemValuePerPoint={loyalty.data?.redeem_value_per_point ?? null}
        />
      ) : null}
    </AccountShell>
  );
}
