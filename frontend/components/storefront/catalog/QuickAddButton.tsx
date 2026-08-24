'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useCartStore } from '@/lib/stores/cart-store';
import { cn } from '@/lib/utils';

/**
 * The grid's one-tap add (`STORE-01`).
 *
 * **Only a product whose price is unambiguous gets one.** A card cannot ask for
 * a variant choice, so a product with two or more variants would have to guess
 * which jar the customer meant — the card links to `/p/[slug]` instead and the
 * decision is made where the options are visible. Variantless and single-variant
 * products have exactly one price, so adding from the grid is honest.
 *
 * **It reads the store, not `useCart()`.** `useCart` mounts `useCustomerAuth`
 * and fires `fetchProfile()` on mount; a grid of 24 cards would mount 24 copies
 * of the session layer to render 24 buttons. `useCartStore`'s `addItem` is the
 * same action `useCart()` re-exports (`hooks/use-cart.ts` spreads the store),
 * without the session weight. The server re-prices every line on the next sync
 * (`CHK-01`), so the local `unitPrice` here is an optimistic display figure and
 * never what the customer is charged.
 *
 * The button sits above the card's stretched link (`relative z-10`) so a click
 * adds to the cart instead of navigating.
 */
export interface QuickAddButtonProps {
  productId: string;
  /** `null` for a variantless product; the single variant's id otherwise. */
  variantId: string | null;
  variantName?: string | null;
  name: string;
  /** Rupees, GST included — `base_price` plus the single variant's delta. */
  unitPrice: number;
  imageUrl: string | null;
  className?: string;
}

/** How long the button holds its "Added" state before returning to "Add". */
const ADDED_FEEDBACK_MS = 1600;

export function QuickAddButton({
  productId,
  variantId,
  variantName,
  name,
  unitPrice,
  imageUrl,
  className,
}: QuickAddButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const router = useRouter();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem({
      productId,
      variantId,
      variantName: variantName ?? null,
      name,
      unitPrice,
      imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
    toast.success(`${name} added to your cart`, {
      description: 'Shipping and any discount are worked out at checkout.',
      action: { label: 'View cart', onClick: () => router.push('/cart') },
    });
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleAdd}
      aria-label={`Add ${name} to cart`}
      className={cn('relative z-10 shrink-0', className)}
    >
      {added ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Plus className="size-3.5" aria-hidden="true" />
      )}
      <span>{added ? 'Added' : 'Add'}</span>
    </Button>
  );
}
