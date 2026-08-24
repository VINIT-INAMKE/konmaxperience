'use client';

import { AccountShell } from '@/components/storefront/account/AccountShell';
import { AddressBook } from '@/components/storefront/account/AddressBook';
import { useAccountAddresses } from '@/components/storefront/account/account-queries';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { apiErrorMessage } from '@/lib/api-client';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

export default function AccountAddressesPage() {
  const { customer, isResolved } = useCustomerAuth();
  const addresses = useAccountAddresses(isResolved && Boolean(customer));

  return (
    <AccountShell
      title="Addresses"
      description="Where we deliver. The default one is picked automatically at checkout."
    >
      {addresses.isPending ? (
        <StorefrontSkeleton variant="list" count={2} />
      ) : addresses.error ? (
        <StorefrontError
          density="inline"
          title="We could not load your addresses"
          description={apiErrorMessage(addresses.error, 'The address book did not come back.')}
          onRetry={() => void addresses.refetch()}
        />
      ) : (
        <AddressBook addresses={addresses.data ?? []} />
      )}
    </AccountShell>
  );
}
