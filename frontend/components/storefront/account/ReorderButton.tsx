'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import { lineKeyOf, useCartStore } from '@/lib/stores/cart-store';
import type { CustomerOrder } from '@/lib/types/marketplace';

/**
 * "Order this again" — re-adds the lines that can still be sold.
 *
 * **Availability is the server's answer, not a guess.** The button does not
 * probe a catalogue endpoint per line and it does not trust the price frozen on
 * the old order: it adds every line, runs one `POST /customer/cart/sync`, and
 * lets `CHK-01`'s re-pricing say which lines survived. Lines the server marks
 * `available: false` — an archived product, a variant that no longer exists, an
 * experience whose event has passed — are then **removed again**, so the cart
 * the customer lands on contains only things they can actually buy, and the
 * toast names how many were dropped rather than leaving them to discover it at
 * checkout.
 *
 * Lines already in the cart before the reorder are never removed, even if the
 * same sync reports them unavailable: the customer put them there deliberately
 * and `/cart` is where that conversation belongs.
 */
export interface ReorderButtonProps {
  order: CustomerOrder;
  className?: string;
}

export function ReorderButton({ order, className }: ReorderButtonProps) {
  const router = useRouter();
  const { syncToServer } = useCart();
  const [busy, setBusy] = useState(false);

  const handleReorder = async () => {
    setBusy(true);
    try {
      const store = useCartStore.getState();
      const preExisting = new Set(store.items.map(lineKeyOf));

      const addedKeys = order.items.map((item) =>
        useCartStore.getState().addItem(
          {
            productId: item.product_id,
            variantId: item.variant_id,
            name: item.product.name,
            unitPrice: item.unit_price,
            imageUrl: null,
          },
          item.quantity,
        ),
      );

      // One round trip re-prices everything and flags what can no longer be sold.
      await syncToServer();

      const after = useCartStore.getState();
      const dropped = after.items.filter(
        (line) =>
          line.available === false &&
          !preExisting.has(lineKeyOf(line)) &&
          addedKeys.includes(lineKeyOf(line)),
      );
      for (const line of dropped) {
        useCartStore.getState().removeItem(lineKeyOf(line));
      }

      const kept = addedKeys.length - dropped.length;
      if (kept === 0) {
        toast.error('Nothing from this order is available right now', {
          description:
            dropped[0]?.unavailable_reason ??
            'Every item on it has been archived or is out of stock.',
        });
        return;
      }

      toast.success(
        `${kept} ${kept === 1 ? 'item' : 'items'} added to your cart`,
        {
          description:
            dropped.length > 0
              ? `${dropped.length} ${dropped.length === 1 ? 'item is' : 'items are'} no longer available and ${dropped.length === 1 ? 'was' : 'were'} left out.`
              : undefined,
          action: { label: 'View cart', onClick: () => router.push('/cart') },
        },
      );
    } catch {
      toast.error('Could not rebuild this order', {
        description: 'Your cart is unchanged. Check your connection and try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={busy || order.items.length === 0}
      onClick={() => void handleReorder()}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <RotateCw className="size-3.5" aria-hidden="true" />
      )}
      Order again
    </Button>
  );
}
