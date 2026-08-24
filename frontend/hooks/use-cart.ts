'use client';

/**
 * The whole customer purchase pipeline — `sync → quote → pay → confirm` — in one
 * hook, over the v3 cart store.
 *
 * ## What was wrong before
 *
 * `use-cart.ts:35` posted an **empty body** to `POST /customer/orders`. That
 * endpoint has taken `{ quote_id }` since P5a: the client no longer describes
 * the order, it names a quote the server already froze (`CHK-01`, `CHK-02`).
 * The empty-body call is gone, and the pay step now lives at the checkout
 * (Task 10) where a quote actually exists.
 *
 * ## The three failures on the pay step are different failures
 *
 * P5a split them deliberately, so {@link createOrder} answers with a **typed
 * result** rather than a thrown string (P5b decision 4):
 *
 * | status | outcome | what the checkout does |
 * |---|---|---|
 * | `410 Gone` | `'requote'` | the quote is still in Redis but its `expires_at` passed — re-quote in place and say the price was refreshed |
 * | `404` | `'restart'` | the quote is gone entirely (never issued, already spent, TTL reaped) — bounce to `/cart` |
 * | `400` | `'stale'` | the price moved or a line vanished — show `message` **verbatim** and re-quote |
 *
 * Everything else is `'error'` and carries the status so the caller can tell a
 * `503` (Redis down, retry) from a genuine fault.
 *
 * ## What throws and what does not
 *
 * {@link syncToServer}, {@link requestQuote} and {@link confirmOrder} throw
 * `ApiError` — their `400`s carry messages written for the customer and the
 * call site must render them verbatim. {@link mergeGuestCart} never throws: it
 * runs on the login path, where a failed cart merge must not block a sign-in.
 */

import { useCallback, useEffect } from 'react';
import { useCartStore, availableLines } from '@/lib/stores/cart-store';
import type { CartLine } from '@/lib/stores/cart-store';
import { useCustomerAuth } from '@/hooks/use-customer-auth';
import { apiClient, apiErrorMessage, apiErrorStatus } from '@/lib/api-client';
import type {
  ConfirmOrderRequest,
  CreateOrderRequest,
  CreateOrderResponse,
  Quote,
  QuoteRequest,
} from '@/lib/types/checkout';
import type { CartData, CustomerOrder, SyncCartPayload } from '@/lib/types/marketplace';

/** What `POST /customer/orders` can mean. See the table in the file header. */
export type CreateOrderOutcome = 'ok' | 'requote' | 'restart' | 'stale' | 'error';

/** The pay step's answer. Never a thrown string — the checkout branches on `outcome`. */
export type CreateOrderResult =
  | { outcome: 'ok'; order: CreateOrderResponse }
  | { outcome: 'requote'; message: string; status: 410 }
  | { outcome: 'restart'; message: string; status: 404 }
  | { outcome: 'stale'; message: string; status: 400 }
  | { outcome: 'error'; message: string; status: number | null };

/** Overrides applied on top of the stored cart for one sync. */
export interface SyncOverrides {
  channel?: CartData['channel'];
  deliveryAddressId?: string | null;
}

/**
 * The wire payload for `POST /customer/cart/sync`.
 *
 * Only the fields the server reads are sent — it re-derives `name`, price,
 * `fulfilment` and availability from `Product` on every sync (`CHK-01`), so a
 * client echo of those is at best redundant and at worst a stale price the
 * server would have to ignore anyway. `variantId` is sent explicitly (including
 * `null`) because it is half the line's identity.
 */
export function buildSyncPayload(
  items: readonly CartLine[],
  channel: CartData['channel'],
  deliveryAddressId: string | null,
): SyncCartPayload {
  const payload: SyncCartPayload = {
    items: items.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      imageUrl: line.imageUrl,
    })),
  };
  if (channel) payload.channel = channel;
  if (deliveryAddressId) payload.deliveryAddressId = deliveryAddressId;
  return payload;
}

export function useCart() {
  const store = useCartStore();
  const { customer, isLoading: isSessionLoading, fetchProfile } = useCustomerAuth();
  const customerId = customer?.id ?? null;

  /**
   * Resolve the session once per mount.
   *
   * `useCustomerAuth` holds its session in component state with no shared
   * context, so a consumer that never calls `fetchProfile` sees `customer` as
   * `null` forever — which would make every `syncToServer` a silent no-op even
   * for a signed-in customer. The call is deduped inside `useCustomerAuth` by
   * its own `fetchedRef`, so this is one request per mount, not one per render.
   */
  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  /**
   * Pushes the local cart at the server and adopts what comes back.
   *
   * The **incoming** cart is authoritative (P5b decision 14): removing a line or
   * changing only the channel round-trips correctly, which the pre-P5b merge
   * rule silently discarded. No-ops without a customer — the cart is local-only
   * until sign-in, and there is no anonymous cart on the server to sync with.
   */
  const syncToServer = useCallback(
    async (overrides: SyncOverrides = {}): Promise<CartData | null> => {
      if (!customerId) return null;
      const state = useCartStore.getState();
      const channel = overrides.channel !== undefined ? overrides.channel : state.channel;
      const addressId =
        overrides.deliveryAddressId !== undefined
          ? overrides.deliveryAddressId
          : state.deliveryAddressId;
      const result = await apiClient.post<CartData>(
        '/customer/cart/sync',
        buildSyncPayload(state.items, channel, addressId),
      );
      useCartStore.getState().reconcile(result);
      return result;
    },
    [customerId],
  );

  /** Re-reads the server cart without pushing local state at it. */
  const refreshFromServer = useCallback(async (): Promise<CartData | null> => {
    if (!customerId) return null;
    const result = await apiClient.get<CartData>('/customer/cart');
    useCartStore.getState().reconcile(result);
    return result;
  }, [customerId]);

  /**
   * The login merge (D-02). Sends the guest cart if there is one; sends an empty
   * cart if there is not, which is exactly the case where the backend seeds the
   * response from the stored cart instead. Never throws — a sign-in must not
   * fail because Redis blinked.
   */
  const mergeGuestCart = useCallback(async (): Promise<CartData | null> => {
    if (!customerId) return null;
    try {
      const state = useCartStore.getState();
      const result = await apiClient.post<CartData>(
        '/customer/cart/sync',
        buildSyncPayload(state.items, state.channel, state.deliveryAddressId),
      );
      useCartStore.getState().reconcile(result);
      return result;
    } catch {
      // The local cart is still usable; the next explicit sync will retry.
      return null;
    }
  }, [customerId]);

  /** Empties the cart on both sides. */
  const clearServerCart = useCallback(async (): Promise<void> => {
    useCartStore.getState().clearCart();
    if (!customerId) return;
    try {
      await apiClient.delete('/customer/cart');
    } catch {
      // A local clear that the server missed is corrected by the next sync.
    }
  }, [customerId]);

  /**
   * Freezes a price. The cart is **not** in the request — the server reads it
   * from Redis, so a client can only ever quote its own cart (`CHK-02`).
   *
   * Throws `ApiError`; its `400`s (`This coupon has expired`,
   * `Add ₹150.00 more to use this coupon`, `We do not deliver to 560001 yet`)
   * are written for the customer and must be shown verbatim.
   */
  const requestQuote = useCallback(async (input: QuoteRequest): Promise<Quote> => {
    return apiClient.post<Quote>('/customer/checkout/quote', input);
  }, []);

  /**
   * Opens a Razorpay order against a frozen quote. Returns a typed outcome — see
   * the table in the file header — and never throws for the three expected
   * failures.
   *
   * `idempotency_key` makes a double-tapped Pay button resolve to the same
   * Razorpay order rather than two.
   */
  const createOrder = useCallback(
    async (quoteId: string, idempotencyKey?: string): Promise<CreateOrderResult> => {
      const body: CreateOrderRequest = { quote_id: quoteId };
      if (idempotencyKey) body.idempotency_key = idempotencyKey;
      try {
        const order = await apiClient.post<CreateOrderResponse>('/customer/orders', body);
        return { outcome: 'ok', order };
      } catch (error) {
        const status = apiErrorStatus(error);
        if (status === 410) {
          return {
            outcome: 'requote',
            status: 410,
            message: apiErrorMessage(error, 'This price has expired. Refreshing it now.'),
          };
        }
        if (status === 404) {
          return {
            outcome: 'restart',
            status: 404,
            message: apiErrorMessage(error, 'That price is no longer available. Start again from your cart.'),
          };
        }
        if (status === 400) {
          return {
            outcome: 'stale',
            status: 400,
            message: apiErrorMessage(error, 'Your cart changed. Refreshing the price.'),
          };
        }
        return {
          outcome: 'error',
          status,
          message: apiErrorMessage(error, 'We could not start the payment. Please try again.'),
        };
      }
    },
    [],
  );

  /**
   * Verifies the Razorpay signature server-side and returns the confirmed
   * order. A replay of the same payload returns the **same** order, not an
   * error, so a retried confirm is safe.
   *
   * The cart is cleared only once the server has answered.
   */
  const confirmOrder = useCallback(
    async (payload: ConfirmOrderRequest): Promise<CustomerOrder> => {
      const order = await apiClient.post<CustomerOrder>('/customer/orders/confirm', payload);
      useCartStore.getState().clearCart();
      return order;
    },
    [],
  );

  return {
    ...store,
    /** Lines the server is willing to sell right now. */
    sellableItems: availableLines(store.items),
    syncToServer,
    refreshFromServer,
    mergeGuestCart,
    clearServerCart,
    requestQuote,
    createOrder,
    confirmOrder,
    customer,
    isLoggedIn: customerId !== null,
    /** `true` while the session is still being resolved — not "signed out". */
    isSessionLoading,
  };
}
