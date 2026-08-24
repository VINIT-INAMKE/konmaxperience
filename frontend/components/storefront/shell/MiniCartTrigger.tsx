'use client';

import { useState, useSyncExternalStore } from 'react';
import { ShoppingBag } from 'lucide-react';

import { useCartStore } from '@/lib/stores/cart-store';
import { cn } from '@/lib/utils';

import { MiniCart } from './MiniCart';

/**
 * The cart button in the header, and the mount point for Task 8's `MiniCart`.
 *
 * This is the storefront shell's **only** client island for cart state, and it
 * reads exactly one number: `items.length`. It deliberately does **not** import
 * `getSubtotal`, the sync hook or anything else that prices a cart — the header
 * is server-rendered around this button, and dragging the pricing layer into it
 * would pull the whole checkout bundle onto every storefront page.
 *
 * **Hydration:** the cart is persisted in `localStorage`, so the server renders
 * a count the client would immediately disagree with. `useSyncExternalStore`
 * with a `getServerSnapshot` of `0` is the sanctioned fix — React uses the
 * server snapshot for the hydration pass and re-renders with the real count
 * straight after, instead of logging a mismatch or flashing through an effect.
 */
export interface MiniCartTriggerProps {
  className?: string;
  /** Shows the word "Cart" beside the icon — the desktop header does, the mobile bar does not. */
  showLabel?: boolean;
}

const subscribe = useCartStore.subscribe;

function getLineCount(): number {
  return useCartStore.getState().items.length;
}

/** The cart is empty until the browser says otherwise. */
function getServerLineCount(): number {
  return 0;
}

export function MiniCartTrigger({ className, showLabel = false }: MiniCartTriggerProps) {
  const [open, setOpen] = useState(false);
  const lineCount = useSyncExternalStore(subscribe, getLineCount, getServerLineCount);

  const label =
    lineCount === 0
      ? 'Cart, empty'
      : `Cart, ${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'relative flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-ink-subtle transition-colors',
          'hover:bg-surface-raised hover:text-ink-strong',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
          className,
        )}
      >
        <span className="relative flex items-center">
          <ShoppingBag className="size-5" aria-hidden="true" />
          {lineCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.625rem] font-semibold leading-none text-brand-ink tabular-nums"
            >
              {lineCount > 9 ? '9+' : lineCount}
            </span>
          ) : null}
        </span>
        {showLabel ? <span className="hidden lg:inline">Cart</span> : null}
      </button>

      {/* Task 8 owns the drawer's insides; the shell owns where it hangs. */}
      <MiniCart open={open} onOpenChange={setOpen} />
    </>
  );
}
