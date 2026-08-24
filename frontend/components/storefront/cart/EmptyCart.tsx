/**
 * The empty cart.
 *
 * Two ways out, because the catalogue has two shapes: things (`/shop`) and
 * dates (`/experiences`). A single "Browse the shop" button would hide half the
 * marketplace from anyone who arrived for a supper club.
 *
 * Deliberately **not** a client component — it holds no state and takes no
 * handlers, so it stays renderable from a server page if one ever needs it.
 */

import { ShoppingBag } from 'lucide-react';

import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';

export interface EmptyCartProps {
  className?: string;
}

export function EmptyCart({ className }: EmptyCartProps) {
  return (
    <StorefrontEmpty
      icon={ShoppingBag}
      title="Your cart is empty"
      description="Everything from the villa kitchen, the pantry shelf and the events calendar lives a click away."
      action={{ label: 'Browse the shop', href: '/shop' }}
      secondaryAction={{ label: 'See what’s on', href: '/experiences' }}
      className={className}
    />
  );
}
