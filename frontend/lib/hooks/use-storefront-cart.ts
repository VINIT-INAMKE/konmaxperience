'use client';

/**
 * The one hook every cart surface renders from — `/cart` (Task 9), the mini-cart
 * and the checkout's line list.
 *
 * It wraps the v3 store and {@link useCart}'s pipeline with the three things a
 * cart UI always needs and should never re-implement:
 *
 * 1. **A hydration gate.** `persist` reads `localStorage` after the first paint,
 *    so a component that renders lines immediately produces a hydration
 *    mismatch. `isHydrated` is `false` until the restore lands; render a
 *    skeleton until then.
 * 2. **Optimistic quantity edits with a debounced sync.** Quantity is the one
 *    optimistic write on the whole money path (P5b decision 24): the number
 *    moves at once and a sync follows {@link DEFAULT_DEBOUNCE_MS} later, so a
 *    customer tapping `+` four times issues one request, not four. Everything
 *    downstream — quote, pay, confirm — waits for the server.
 * 3. **The server's prices winning.** `subtotal` is `totals.subtotal` once a
 *    sync has landed and only falls back to the local optimistic sum before
 *    that. `repricedKeys` names the lines whose price the server moved, so the
 *    UI can mark them instead of swapping a number silently.
 *
 * **There is no grand total here, deliberately** (P5b decision 6). Shipping,
 * coupon discount and loyalty exist only inside a quote, and quoting needs an
 * address — a cart that showed a total would either be lying or forcing a
 * premature address prompt.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import {
  useCartHydrated,
  useCartStore,
  type CartLine,
  type CartTotals,
} from '@/lib/stores/cart-store';
import { apiErrorMessage } from '@/lib/api-client';
import type { FulfilmentType } from '@/lib/types/catalog';
import type { CheckoutChannel } from '@/lib/types/checkout';

/** Plan Task 9: quantity changes re-sync 400 ms after the last edit. */
export const DEFAULT_DEBOUNCE_MS = 400;

export interface UseStorefrontCartOptions {
  /**
   * Sync as soon as the cart has hydrated and a session exists. `/cart` does
   * (it needs server prices to render); the mini-cart does not (it opens on top
   * of a page that has already synced).
   */
  syncOnMount?: boolean;
  debounceMs?: number;
}

export interface StorefrontCart {
  lines: CartLine[];
  /** Lines the server will sell. */
  available: CartLine[];
  /** Lines the server refused, each carrying its own `unavailable_reason`. */
  unavailable: CartLine[];
  /** The three fulfilment sections `/cart` renders. Always all three keys. */
  groups: Record<FulfilmentType, CartLine[]>;
  /** Total units, not total lines. */
  count: number;
  /** Server subtotal when {@link isServerPriced}, else the local optimistic sum. */
  subtotal: number;
  /** GST carved out of `subtotal`. `null` until a sync has landed. */
  taxTotal: number | null;
  totals: CartTotals | null;
  /** `true` once a sync has replaced the local prices with the server's. */
  isServerPriced: boolean;
  /** Keys whose `unitPrice` the server changed on the last sync. */
  repricedKeys: Set<string>;
  isHydrated: boolean;
  isSyncing: boolean;
  /** The server's message from the last failed sync, verbatim. */
  error: string | null;
  isLoggedIn: boolean;
  isSessionLoading: boolean;
  channel: CheckoutChannel | null;
  deliveryAddressId: string | null;
  /** `false` while the cart is empty or any line is unavailable. */
  canCheckout: boolean;
  /** Why checkout is blocked, written for the customer. `null` when it is not. */
  blockedReason: string | null;

  setQuantity: (key: string, quantity: number) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  /** Clears every line the server refused, in one gesture. */
  removeUnavailable: () => void;
  clear: () => void;
  setChannel: (channel: CheckoutChannel) => void;
  setDeliveryAddress: (addressId: string | null) => void;
  /** Force a sync now, bypassing the debounce. */
  sync: () => Promise<void>;
}

function emptyGroups(): Record<FulfilmentType, CartLine[]> {
  return { local: [], shipped: [], booking: [] };
}

export function useStorefrontCart({
  syncOnMount = false,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseStorefrontCartOptions = {}): StorefrontCart {
  const cart = useCart();
  const isHydrated = useCartHydrated();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { syncToServer, isLoggedIn } = cart;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped on every sync so a slow response cannot overwrite a newer one. */
  const sequence = useRef(0);

  const runSync = useCallback(async () => {
    if (!isLoggedIn) return;
    const ticket = ++sequence.current;
    setIsSyncing(true);
    try {
      await syncToServer();
      if (ticket === sequence.current) setError(null);
    } catch (caught) {
      if (ticket === sequence.current) {
        setError(apiErrorMessage(caught, 'We could not refresh your cart. Your items are safe.'));
      }
    } finally {
      if (ticket === sequence.current) setIsSyncing(false);
    }
  }, [isLoggedIn, syncToServer]);

  const scheduleSync = useCallback(() => {
    if (!isLoggedIn) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void runSync();
    }, debounceMs);
  }, [debounceMs, isLoggedIn, runSync]);

  // A pending debounce must not fire into an unmounted component.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (!syncOnMount || !isHydrated || !isLoggedIn) return;
    void runSync();
  }, [syncOnMount, isHydrated, isLoggedIn, runSync]);

  // Before hydration the store still holds the empty server-render cart; showing
  // it would flash "your cart is empty" at a customer who has items.
  const lines = useMemo(() => (isHydrated ? cart.items : []), [isHydrated, cart.items]);

  const available = useMemo(() => lines.filter((l) => l.available !== false), [lines]);
  const unavailable = useMemo(() => lines.filter((l) => l.available === false), [lines]);

  const groups = useMemo(() => {
    const next = emptyGroups();
    for (const line of available) {
      // `fulfilment` is null only for a line the server could not price at all;
      // it belongs with the villa lines rather than vanishing from the page.
      next[line.fulfilment ?? 'local'].push(line);
    }
    return next;
  }, [available]);

  const count = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  const localSubtotal = useMemo(
    () => Number(available.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0).toFixed(2)),
    [available],
  );

  const totals = isHydrated ? cart.totals : null;
  const isServerPriced = totals !== null;
  const repricedKeys = useMemo(() => new Set(cart.repriced), [cart.repriced]);

  const blockedReason = useMemo(() => {
    if (lines.length === 0) return 'Your cart is empty.';
    if (unavailable.length > 0) {
      return unavailable.length === 1
        ? 'One item is unavailable. Remove it to continue.'
        : `${unavailable.length} items are unavailable. Remove them to continue.`;
    }
    return null;
  }, [lines.length, unavailable.length]);

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      useCartStore.getState().updateQuantity(key, quantity);
      scheduleSync();
    },
    [scheduleSync],
  );

  const increment = useCallback(
    (key: string) => {
      const store = useCartStore.getState();
      store.updateQuantity(key, store.getQuantity(key) + 1);
      scheduleSync();
    },
    [scheduleSync],
  );

  const decrement = useCallback(
    (key: string) => {
      const store = useCartStore.getState();
      store.updateQuantity(key, store.getQuantity(key) - 1);
      scheduleSync();
    },
    [scheduleSync],
  );

  const remove = useCallback(
    (key: string) => {
      useCartStore.getState().removeItem(key);
      scheduleSync();
    },
    [scheduleSync],
  );

  const removeUnavailable = useCallback(() => {
    const store = useCartStore.getState();
    store.replaceCart(
      store.items.filter((l) => l.available !== false),
      store.channel,
      store.deliveryAddressId,
    );
    scheduleSync();
  }, [scheduleSync]);

  const { clearServerCart, setChannel: storeSetChannel, setDeliveryAddress } = cart;

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void clearServerCart();
  }, [clearServerCart]);

  const setChannel = useCallback(
    (next: CheckoutChannel) => {
      storeSetChannel(next);
      scheduleSync();
    },
    [scheduleSync, storeSetChannel],
  );

  const setDeliveryAddressAndSync = useCallback(
    (addressId: string | null) => {
      setDeliveryAddress(addressId);
      scheduleSync();
    },
    [scheduleSync, setDeliveryAddress],
  );

  const sync = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await runSync();
  }, [runSync]);

  return {
    lines,
    available,
    unavailable,
    groups,
    count,
    subtotal: isServerPriced ? totals.subtotal : localSubtotal,
    taxTotal: totals?.tax_total ?? null,
    totals,
    isServerPriced,
    repricedKeys,
    isHydrated,
    isSyncing,
    error,
    isLoggedIn,
    isSessionLoading: cart.isSessionLoading,
    channel: cart.channel,
    deliveryAddressId: cart.deliveryAddressId,
    canCheckout: blockedReason === null,
    blockedReason,
    setQuantity,
    increment,
    decrement,
    remove,
    removeUnavailable,
    clear,
    setChannel,
    setDeliveryAddress: setDeliveryAddressAndSync,
    sync,
  };
}
