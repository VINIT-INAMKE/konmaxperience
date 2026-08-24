'use client';

import { useEffect } from 'react';

import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { reportError } from '@/lib/report-error';

/**
 * The storefront's error boundary.
 *
 * The way out is `/shop`, not `/menu`: `/menu` is a permanent redirect into
 * `/shop?type=prepared_food` (P5b decision 20), so sending a customer there
 * after a failure would cost them a second navigation and land them in a
 * filtered view of the catalogue rather than the catalogue.
 */
export default function PublicError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: 'public', digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <StorefrontError
        description="Your cart is safe. Try again, or head back to the shop."
        digest={error.digest}
        onRetry={() => unstable_retry()}
        href="/shop"
        actionLabel="Back to the shop"
        className="w-full max-w-lg"
      />
    </div>
  );
}
