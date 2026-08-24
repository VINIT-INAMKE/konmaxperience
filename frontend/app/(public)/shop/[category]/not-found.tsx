import { PackageOpen } from 'lucide-react';

import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';

/**
 * The `notFound()` boundary for an unknown `/shop/[category]` slug.
 *
 * Without it the request falls through to the root `app/not-found.tsx`, which
 * renders **outside** the `(public)` route group — so a mistyped shelf would
 * lose the storefront header, the nav and the cart button, and a customer with
 * items in their cart would be looking at a bare page wondering where the shop
 * went. This keeps the shell and offers the two ways back in.
 */
export default function CategoryNotFound() {
  return (
    <StorefrontEmpty
      icon={PackageOpen}
      title="We could not find that shelf"
      description="The link may be out of date, or the category may have been renamed. Everything else is still on the shelves."
      action={{ label: 'Browse the shop', href: '/shop' }}
      secondaryAction={{ label: 'Search instead', href: '/search' }}
    />
  );
}
