'use client';

/**
 * `POST /customer/checkout/serviceability` — the reason P5b Task 2 added the
 * route at all.
 *
 * Without it the only way to discover that a pincode is not served is to fill
 * the whole checkout in and have `POST /customer/checkout/quote` answer `400`.
 * This asks the same question **before a quote exists**, so the fulfilment step
 * can say "we do not deliver here yet — collect at the villa instead" while the
 * customer is still choosing.
 *
 * Two halves come back and they mean different things:
 *
 * - `local` — the villa's own delivery allow-list. Unserviceable is recoverable:
 *   the customer can switch to pickup.
 * - `shipped` — the courier. **`null`, not `{ serviceable: false }`**, when the
 *   cart holds no shipped line, because "does this parcel reach you" is not a
 *   question that arises. Treating `null` as "not serviceable" is the shape bug
 *   this hook exists to make impossible at the call sites.
 *
 * The cart is read from Redis server-side, so the request carries only the
 * pincode and the channel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { apiClient, apiErrorMessage } from '@/lib/api-client';
import type {
  CheckoutChannel,
  ServiceabilityRequest,
  ServiceabilityResponse,
} from '@/lib/types/checkout';

/** The DTO validates `@Matches(/^\d{6}$/)`; asking with less is a wasted 400. */
export function isCompletePincode(pincode: string | null | undefined): boolean {
  return typeof pincode === 'string' && /^\d{6}$/.test(pincode.trim());
}

export interface UseServiceabilityOptions {
  pincode: string | null;
  channel: CheckoutChannel;
  /** `false` while the step is not shown, or the cart is not ready to be asked about. */
  enabled?: boolean;
}

export interface UseServiceabilityResult {
  result: ServiceabilityResponse | null;
  isLoading: boolean;
  /** A transport failure, not an unserviceable answer — those live in `result`. */
  error: string | null;
  refresh: () => void;
}

export function useServiceability({
  pincode,
  channel,
  enabled = true,
}: UseServiceabilityOptions): UseServiceabilityResult {
  const [result, setResult] = useState<ServiceabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const sequence = useRef(0);

  const trimmed = pincode?.trim() ?? '';
  const active = enabled && isCompletePincode(trimmed);

  useEffect(() => {
    if (!active) {
      // Cancel anything in flight; a half-typed pincode has no answer to show.
      sequence.current += 1;
      setResult(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const ticket = ++sequence.current;
    const body: ServiceabilityRequest = { pincode: trimmed, channel };
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const answer = await apiClient.post<ServiceabilityResponse>(
          '/customer/checkout/serviceability',
          body,
        );
        if (ticket !== sequence.current) return;
        setResult(answer);
      } catch (caught) {
        if (ticket !== sequence.current) return;
        setResult(null);
        setError(
          apiErrorMessage(caught, 'We could not check delivery for this pincode just now.'),
        );
      } finally {
        if (ticket === sequence.current) setIsLoading(false);
      }
    })();
    // `nonce` is the manual retry: same pincode, deliberate re-ask.
  }, [active, trimmed, channel, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { result, isLoading, error, refresh };
}
