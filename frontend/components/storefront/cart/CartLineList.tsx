'use client';

/**
 * The sellable half of `/cart`: the three fulfilment sections, in the order a
 * customer will receive them.
 *
 * Rejected lines are **not** here. They live in {@link RejectedLines} above the
 * summary, because a line the server refused is a blocking problem, not another
 * row to scroll past.
 */

import type { CartLine as CartLineModel } from '@/lib/stores/cart-store';
import type { FulfilmentType } from '@/lib/types/catalog';
import { cn } from '@/lib/utils';

import { CartFulfilmentGroup, FULFILMENT_ORDER } from './CartFulfilmentGroup';

export interface CartLineListProps {
  /** Always all three keys — `useStorefrontCart` guarantees it. */
  groups: Record<FulfilmentType, CartLineModel[]>;
  repricedKeys: ReadonlySet<string>;
  busy?: boolean;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  className?: string;
}

export function CartLineList({
  groups,
  repricedKeys,
  busy = false,
  onIncrement,
  onDecrement,
  onRemove,
  className,
}: CartLineListProps) {
  return (
    <div data-slot="cart-line-list" className={cn('space-y-5', className)}>
      {FULFILMENT_ORDER.map((fulfilment) => (
        <CartFulfilmentGroup
          key={fulfilment}
          fulfilment={fulfilment}
          lines={groups[fulfilment]}
          repricedKeys={repricedKeys}
          busy={busy}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
