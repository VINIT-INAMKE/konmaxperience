'use client';

/**
 * The storefront cart — **v3**.
 *
 * ## What changed, and why it needed a version bump
 *
 * v2 keyed every line by `productId` alone. Two variants of one product
 * (a 250 g and a 500 g jar) collapsed into a single line at whichever price was
 * added first — a wrong-price bug, not a cosmetic one. v3 makes `variantId` part
 * of a line's **identity**: lines are keyed by
 * {@link cartLineKey `${productId}:${variantId ?? ''}`}, byte-identical to the
 * key the backend's `assertQuoteStillValid` builds, so a client line and a
 * server line can be matched without guessing.
 *
 * Because a v2 cart carries no variant information at all, it cannot be
 * salvaged — there is no way to know which variant a v2 line meant. `migrate`
 * therefore **drops** a pre-v3 cart rather than half-reading it, which is the
 * precedent v2 itself set when it dropped v1.
 *
 * ## Local numbers are optimistic; server numbers are authoritative
 *
 * {@link CartState.getSubtotal} is a *local* sum of `unitPrice × quantity` and
 * exists only so the mini-cart can show something between syncs. The figure a
 * customer is asked to agree to always comes from the server: `totals.subtotal`
 * after {@link CartState.reconcile}, and the quote's own `subtotal` at checkout
 * (`CHK-01`). Nothing in the UI may present `getSubtotal()` as authoritative.
 *
 * `totals`, `syncedAt` and `repriced` are **not persisted** — a stale price
 * restored from `localStorage` a day later would be worse than no price.
 */

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CheckoutChannel } from '@/lib/types/checkout';
import type { CartData, CartItem } from '@/lib/types/marketplace';
import { cartLineKey } from '@/lib/types/storefront';

/** The `localStorage` key. Exported so a test or a support tool can clear it. */
export const CART_STORAGE_KEY = 'cart-storage';

/** Bumped from 2 when `variantId` joined the line identity (P5b decision 2). */
export const CART_STORE_VERSION = 3;

/**
 * A line as the store holds it: a {@link CartItem} whose `variantId` is always
 * *resolved* to `string | null`, never left `undefined`.
 *
 * The distinction is load-bearing. `CartItem.variantId` is optional because a
 * caller may build a line before it knows about variants; `CartLine.variantId`
 * is required because the store normalises every write. That makes `CartItem`
 * assignable *into* the store and `CartLine` safe to key on the way out.
 */
export type CartLine = CartItem & { variantId: string | null };

/** The server's cart totals. `tax_total` is carved out of `subtotal`, never added. */
export interface CartTotals {
  subtotal: number;
  tax_total: number;
}

/** The slice `partialize` writes to `localStorage`. */
interface PersistedCart {
  items: CartLine[];
  channel: CheckoutChannel | null;
  deliveryAddressId: string | null;
}

export interface CartState extends PersistedCart {
  /**
   * Server-priced totals from the last successful sync, or `null` before one.
   * Never persisted — see the file header.
   */
  totals: CartTotals | null;
  /** ISO stamp of the last successful reconciliation, or `null`. */
  syncedAt: string | null;
  /**
   * Keys whose `unitPrice` the server changed on the last reconcile. `/cart`
   * renders a quiet "price updated" marker against these rather than swapping
   * the number silently.
   */
  repriced: string[];

  /**
   * Adds a line, or increases an existing line with the **same product and
   * variant**. Returns the line key so a caller can immediately scroll to,
   * highlight or open the mini-cart on it.
   */
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => string;
  /** Removes one line **by composite key** — not by product id. */
  removeItem: (key: string) => void;
  /** Sets a line's quantity by composite key; `<= 0` removes it. */
  updateQuantity: (key: string, quantity: number) => void;
  setChannel: (channel: CheckoutChannel) => void;
  setDeliveryAddress: (addressId: string | null) => void;
  clearCart: () => void;
  /**
   * Wholesale replacement, normalising every incoming line. Accepts the loose
   * {@link CartItem} so a caller holding a server `PricedCartItem[]` or a
   * locally-built list can both use it.
   */
  replaceCart: (
    items: readonly CartItem[],
    channel?: CheckoutChannel | null,
    addressId?: string | null,
  ) => void;
  /**
   * Adopts a server cart envelope: the server's prices, availability and
   * fulfilment win, `totals` becomes authoritative, and {@link CartState.repriced}
   * records which lines moved.
   */
  reconcile: (server: CartData) => void;
  getTotalItems: () => number;
  /** **Optimistic and local.** Never render this as the authoritative subtotal. */
  getSubtotal: () => number;
  getLine: (key: string) => CartLine | undefined;
  getQuantity: (key: string) => number;
}

/** `undefined` and `null` both mean "this product has no variant". */
function resolveVariantId(variantId: string | null | undefined): string | null {
  return typeof variantId === 'string' && variantId !== '' ? variantId : null;
}

/** The key of a line, whatever shape it arrived in. */
export function lineKeyOf(line: Pick<CartItem, 'productId' | 'variantId'>): string {
  return cartLineKey(line.productId, resolveVariantId(line.variantId));
}

/** Normalises one incoming line into the shape the store guarantees. */
function toCartLine(item: CartItem): CartLine {
  return {
    ...item,
    variantId: resolveVariantId(item.variantId),
    variantName: item.variantName ?? null,
    quantity: Math.max(0, Math.floor(item.quantity)) || 1,
    unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
    imageUrl: item.imageUrl ?? null,
  };
}

/**
 * Normalises a list and folds duplicates that share a key — two lines with the
 * same key would make `updateQuantity` ambiguous, and a server that ever sent
 * such a pair must not be able to corrupt the local cart.
 */
function normaliseLines(items: readonly CartItem[]): CartLine[] {
  const byKey = new Map<string, CartLine>();
  for (const raw of items) {
    if (typeof raw?.productId !== 'string' || raw.productId === '') continue;
    const line = toCartLine(raw);
    const key = lineKeyOf(line);
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      byKey.set(key, line);
    }
  }
  return [...byKey.values()];
}

/** The empty cart — also the value `migrate` returns for any pre-v3 payload. */
function emptyCart(): PersistedCart {
  return { items: [], channel: null, deliveryAddressId: null };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...emptyCart(),
      totals: null,
      syncedAt: null,
      repriced: [],

      addItem: (item, quantity = 1) => {
        const line = toCartLine({ ...item, quantity });
        const key = lineKeyOf(line);
        set((state) => {
          const exists = state.items.some((i) => lineKeyOf(i) === key);
          if (exists) {
            return {
              items: state.items.map((i) =>
                lineKeyOf(i) === key ? { ...i, quantity: i.quantity + line.quantity } : i,
              ),
            };
          }
          return { items: [...state.items, line] };
        });
        return key;
      },

      removeItem: (key) =>
        set((state) => ({
          items: state.items.filter((i) => lineKeyOf(i) !== key),
          repriced: state.repriced.filter((k) => k !== key),
        })),

      updateQuantity: (key, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((i) => lineKeyOf(i) !== key),
              repriced: state.repriced.filter((k) => k !== key),
            };
          }
          return {
            items: state.items.map((i) =>
              lineKeyOf(i) === key ? { ...i, quantity: Math.floor(quantity) } : i,
            ),
          };
        }),

      setChannel: (channel) => set({ channel }),

      setDeliveryAddress: (addressId) => set({ deliveryAddressId: addressId }),

      clearCart: () =>
        set({ ...emptyCart(), totals: null, syncedAt: null, repriced: [] }),

      replaceCart: (items, channel, addressId) =>
        set({
          items: normaliseLines(items),
          channel: channel ?? null,
          deliveryAddressId: addressId ?? null,
          repriced: [],
        }),

      reconcile: (server) => {
        const before = new Map(get().items.map((i) => [lineKeyOf(i), i] as const));
        const items = normaliseLines(server.items ?? []);
        const repriced = items
          .filter((line) => {
            const previous = before.get(lineKeyOf(line));
            return previous !== undefined && previous.unitPrice !== line.unitPrice;
          })
          .map(lineKeyOf);
        set({
          items,
          // The server echoes what it stored; a `null` channel means "not chosen
          // yet", so it must not clobber a choice the customer just made locally.
          channel: server.channel ?? get().channel,
          deliveryAddressId: server.deliveryAddressId ?? get().deliveryAddressId,
          totals: server.totals ?? null,
          syncedAt: server.updatedAt ?? new Date().toISOString(),
          repriced,
        });
      },

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      getSubtotal: () =>
        Number(
          get()
            .items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
            .toFixed(2),
        ),

      getLine: (key) => get().items.find((i) => lineKeyOf(i) === key),

      getQuantity: (key) => get().items.find((i) => lineKeyOf(i) === key)?.quantity ?? 0,
    }),
    {
      name: CART_STORAGE_KEY,
      // v1 keyed lines by the old menu-item id; v2 keyed them by `productId`
      // alone and so carries no variant information. Neither can be read into a
      // variant-keyed cart without inventing data, so both are dropped.
      version: CART_STORE_VERSION,
      migrate: () => emptyCart(),
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (state): PersistedCart => ({
        items: state.items,
        channel: state.channel,
        deliveryAddressId: state.deliveryAddressId,
      }),
      // Belt and braces. `migrate` only runs when the stored `version` differs,
      // so a payload written by an older tab that *claims* v3 still reaches
      // here. A genuine v3 writer always emits the `variantId` key (JSON keeps
      // an explicit `null`); a line without it predates the identity change and
      // is dropped rather than silently treated as the variantless line.
      merge: (persisted, current): CartState => {
        const stored = (persisted ?? {}) as Partial<PersistedCart>;
        const rows = Array.isArray(stored.items) ? stored.items : [];
        const usable = rows.filter((row): row is CartLine => {
          if (typeof row !== 'object' || row === null) return false;
          const line = row as Partial<CartItem>;
          if (typeof line.productId !== 'string' || line.productId === '') return false;
          if (!('variantId' in line)) return false;
          return line.variantId === null || typeof line.variantId === 'string';
        });
        return {
          ...current,
          items: normaliseLines(usable),
          channel: stored.channel ?? null,
          deliveryAddressId: stored.deliveryAddressId ?? null,
          // Never restore server figures from disk.
          totals: null,
          syncedAt: null,
          repriced: [],
        };
      },
    },
  ),
);

/**
 * `false` until `persist` has read `localStorage`.
 *
 * Every cart surface needs this: the server renders an empty cart, so painting
 * the restored one before hydration finishes is a React hydration mismatch.
 * Render a skeleton while this is `false`.
 */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useCartStore.persist.onFinishHydration(onStoreChange),
    () => useCartStore.persist.hasHydrated(),
    // The server snapshot is always "not hydrated": there is no `localStorage`
    // there, so the server HTML must describe an empty cart.
    () => false,
  );
}

/** Lines the server refused to price. `available` is `undefined` until first sync. */
export function unavailableLines(items: readonly CartLine[]): CartLine[] {
  return items.filter((i) => i.available === false);
}

/** Lines the server is willing to sell. */
export function availableLines(items: readonly CartLine[]): CartLine[] {
  return items.filter((i) => i.available !== false);
}
