'use client';

import { AccountShell } from '@/components/storefront/account/AccountShell';
import { OrderHistoryList } from '@/components/storefront/account/OrderHistoryList';
import { useAccountOrders } from '@/components/storefront/account/account-queries';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

/**
 * `ACCT-01` — every order the customer has ever placed, in one list.
 *
 * `GET /customer/orders` returns all channels (dine-in, takeaway, delivery,
 * marketplace) and all three fulfilment types with no filtering, and the page
 * keeps it that way deliberately: see `OrderHistoryList`.
 */
export default function AccountOrdersPage() {
  const { customer, isResolved } = useCustomerAuth();
  const orders = useAccountOrders(isResolved && Boolean(customer));

  return (
    <AccountShell
      title="Orders"
      description="Everything you have bought from us — in the villa, by post, or a seat at a workshop."
    >
      <OrderHistoryList
        orders={orders.data}
        isPending={orders.isPending}
        error={orders.error}
        onRetry={() => void orders.refetch()}
      />
    </AccountShell>
  );
}
