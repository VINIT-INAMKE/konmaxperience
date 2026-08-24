import { PackageSearch } from 'lucide-react';

import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';

/**
 * The `404` for a product slug that does not resolve.
 *
 * It is reached only from `notFound()` in `page.tsx`, which fires **only** when
 * the backend answered `404` — an unknown slug, or a product that is `draft` or
 * `archived` (`findProductBySlug` refuses anything that is not `active`). A
 * catalog outage throws instead and lands on the storefront error boundary, so
 * this page never stands in for "the server is having a moment".
 *
 * Both ways out are links, not handlers, so this stays a server component.
 */
export default function ProductNotFound() {
  return (
    <StorefrontEmpty
      icon={PackageSearch}
      title="We could not find that one"
      description="It may have sold out for good, or the link may have a typo in it. The shop is still full of things worth eating."
      action={{ label: 'Browse the shop', href: '/shop' }}
      secondaryAction={{ label: 'Search', href: '/search' }}
    />
  );
}
