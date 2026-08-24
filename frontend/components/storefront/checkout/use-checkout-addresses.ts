'use client';

/**
 * The customer's saved addresses, for the checkout's fulfilment step.
 *
 * The backend has **no dedicated address controller** — CRUD hangs off
 * `CustomerOrdersController` under `/customer/addresses`
 * (`backend/src/customer-orders/customer-orders.controller.ts:137-179`). The
 * shape is deliberately flat: one free-text `address`, an optional `landmark`
 * and a six-digit `pincode`. There is no `line1`/`city`/`state` split and
 * `is_default` is **server-controlled** — it is set on the first address and
 * changed only through `PATCH /customer/addresses/:id/default`, never accepted
 * in a create or update body. Sending one would be silently dropped by the
 * `ValidationPipe`, so {@link CustomerAddressPayload} does not carry it.
 *
 * Plain `useState`/`useEffect` rather than TanStack Query, to match the two
 * hooks this screen already composes with (`use-quote`, `use-storefront-cart`).
 * The list is small, read once per checkout and mutated by this screen alone.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { apiClient, apiErrorMessage } from '@/lib/api-client';
import type { CustomerAddress, CustomerAddressPayload } from '@/lib/types/marketplace';

export interface UseCheckoutAddressesResult {
  addresses: CustomerAddress[];
  /** `true` only while the first load is in flight — a re-read does not blank the list. */
  isLoading: boolean;
  isSaving: boolean;
  /** The server's message, verbatim. */
  error: string | null;
  clearError: () => void;
  reload: () => Promise<void>;
  /** Returns the created row so the caller can select it immediately. */
  create: (payload: CustomerAddressPayload) => Promise<CustomerAddress | null>;
}

export function useCheckoutAddresses(enabled: boolean): UseCheckoutAddressesResult {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** A superseded read is discarded rather than applied over a newer one. */
  const sequence = useRef(0);
  const hasLoaded = useRef(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const ticket = ++sequence.current;
    if (!hasLoaded.current) setIsLoading(true);
    try {
      const rows = await apiClient.get<CustomerAddress[]>('/customer/addresses');
      if (ticket !== sequence.current) return;
      setAddresses(Array.isArray(rows) ? rows : []);
      setError(null);
      hasLoaded.current = true;
    } catch (caught) {
      if (ticket !== sequence.current) return;
      setError(apiErrorMessage(caught, 'We could not load your saved addresses.'));
    } finally {
      if (ticket === sequence.current) setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      // Signing out mid-checkout must not leave someone else's addresses on screen.
      sequence.current += 1;
      hasLoaded.current = false;
      setAddresses([]);
      return;
    }
    void reload();
  }, [enabled, reload]);

  const create = useCallback(
    async (payload: CustomerAddressPayload): Promise<CustomerAddress | null> => {
      setIsSaving(true);
      setError(null);
      try {
        const created = await apiClient.post<CustomerAddress>('/customer/addresses', payload);
        setAddresses((prev) => [...prev, created]);
        return created;
      } catch (caught) {
        setError(apiErrorMessage(caught, 'We could not save that address. Please try again.'));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { addresses, isLoading, isSaving, error, clearError, reload, create };
}
