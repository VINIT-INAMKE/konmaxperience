'use client';

/**
 * The quote lifecycle for `/checkout` (P5b decision 3).
 *
 * ## A quote is fetched once, at the review step — not on every keystroke
 *
 * `POST /customer/checkout/quote` writes a frozen price into Redis, creates
 * 15-minute `held` bookings for every experience line and burns a coupon
 * validation. Issuing one per keystroke would churn holds and mislead the
 * customer about what they are agreeing to. So the request is derived from
 * **five primitives** — channel, address, pickup, coupon, points — and a fetch
 * happens only when one of them actually changes. An unrelated re-render, a
 * parent state update or a new object identity for the same intentions all
 * produce the same key and no request.
 *
 * ## The countdown is one interval
 *
 * `expires_at` drives a single `setInterval` that ticks once a second, is
 * restarted only when the quote itself changes, and is cleared on unmount. At
 * zero the checkout disables Pay and offers {@link UseQuoteResult.refresh} —
 * this is the containment for P5a risk 5, a payment captured after its booking
 * hold was swept.
 *
 * ## Errors are the server's words
 *
 * A `400` here carries a message written for the customer
 * (`This coupon has expired`, `Add ₹150.00 more to use this coupon`,
 * `We do not deliver to 560001 yet`). {@link UseQuoteResult.error} is that
 * message verbatim; `errorStatus` separates a `503` (Redis down — retry) from a
 * `400` (the customer can act on it).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, apiErrorMessage, apiErrorStatus } from '@/lib/api-client';
import type { Quote, QuoteRequest } from '@/lib/types/checkout';

/** Under this many seconds the countdown turns warning-toned (plan Task 10). */
export const QUOTE_WARNING_SECONDS = 180;

export type QuoteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseQuoteOptions {
  /**
   * The customer's intentions. `null` disables quoting entirely — pass it until
   * the review step is reached, so steps 1 and 2 never issue a quote.
   */
  input: QuoteRequest | null;
  /** A second gate, e.g. "the cart has no unavailable line". Defaults to `true`. */
  enabled?: boolean;
  onQuote?: (quote: Quote) => void;
  onError?: (message: string, status: number | null) => void;
}

export interface UseQuoteResult {
  quote: Quote | null;
  status: QuoteStatus;
  isLoading: boolean;
  /** The server's message, verbatim. `null` when the last attempt succeeded. */
  error: string | null;
  errorStatus: number | null;
  /** Epoch milliseconds, or `null` when there is no live quote. */
  expiresAt: number | null;
  /** Milliseconds left — feed to `formatCountdown` for `mm:ss`. */
  msLeft: number;
  secondsLeft: number;
  /** `true` only when a quote exists **and** its window has closed. */
  isExpired: boolean;
  /** `true` inside the last {@link QUOTE_WARNING_SECONDS} of a live quote. */
  isExpiring: boolean;
  /** Re-issues the quote with the current inputs. Used by "Refresh price". */
  refresh: () => Promise<Quote | null>;
  /** Drops the quote and cancels any in-flight request. */
  clear: () => void;
}

/**
 * The stable identity of a quote request.
 *
 * Exported because the checkout's own debounce keys off the same string: two
 * requests with the same key must never both be issued.
 */
export function quoteInputKey(input: QuoteRequest | null): string | null {
  if (!input) return null;
  return JSON.stringify([
    input.channel,
    input.delivery_address_id ?? null,
    input.pickup ?? false,
    input.coupon_code ?? null,
    input.redeem_points ?? 0,
  ]);
}

const GENERIC_ERROR = 'We could not price your cart just now. Please try again.';

export function useQuote({
  input,
  enabled = true,
  onQuote,
  onError,
}: UseQuoteOptions): UseQuoteResult {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<QuoteStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  /** Monotonic request id: a superseded response is discarded, never applied. */
  const sequence = useRef(0);
  const callbacks = useRef({ onQuote, onError });
  useEffect(() => {
    callbacks.current = { onQuote, onError };
  });

  // Everything the request is made of, as primitives — so the memo below changes
  // identity exactly when an *intention* changes and never merely on re-render.
  const channel = input?.channel ?? null;
  const addressId = input?.delivery_address_id ?? null;
  const pickup = input?.pickup ?? false;
  const couponCode = input?.coupon_code ?? null;
  const redeemPoints = input?.redeem_points ?? 0;

  const request = useMemo<QuoteRequest | null>(() => {
    if (!channel) return null;
    const next: QuoteRequest = { channel };
    if (addressId) next.delivery_address_id = addressId;
    if (pickup) next.pickup = true;
    if (couponCode) next.coupon_code = couponCode;
    if (redeemPoints > 0) next.redeem_points = redeemPoints;
    return next;
  }, [channel, addressId, pickup, couponCode, redeemPoints]);

  const fetchQuote = useCallback(async (body: QuoteRequest): Promise<Quote | null> => {
    const ticket = ++sequence.current;
    setStatus('loading');
    setError(null);
    setErrorStatus(null);
    try {
      const next = await apiClient.post<Quote>('/customer/checkout/quote', body);
      if (ticket !== sequence.current) return null;
      setQuote(next);
      setStatus('ready');
      callbacks.current.onQuote?.(next);
      return next;
    } catch (caught) {
      if (ticket !== sequence.current) return null;
      const message = apiErrorMessage(caught, GENERIC_ERROR);
      const httpStatus = apiErrorStatus(caught);
      setQuote(null);
      setError(message);
      setErrorStatus(httpStatus);
      setStatus('error');
      callbacks.current.onError?.(message, httpStatus);
      return null;
    }
  }, []);

  const active = enabled && request !== null;

  useEffect(() => {
    if (!active || !request) {
      // Cancel anything in flight, then drop back to "no quote yet".
      sequence.current += 1;
      setQuote(null);
      setStatus('idle');
      setError(null);
      setErrorStatus(null);
      return;
    }
    void fetchQuote(request);
  }, [active, request, fetchQuote]);

  const expiresAt = useMemo(() => {
    if (!quote) return null;
    const parsed = Date.parse(quote.expires_at);
    return Number.isFinite(parsed) ? parsed : null;
  }, [quote]);

  // One interval, restarted only when the quote's own deadline moves. `now` is
  // left untouched when there is no quote: `expiresAt === null` already forces
  // `msLeft` to zero, so resetting the clock would be a render for nothing.
  useEffect(() => {
    if (expiresAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const msLeft = expiresAt === null || now === 0 ? 0 : Math.max(0, expiresAt - now);
  const secondsLeft = Math.ceil(msLeft / 1000);
  // `now === 0` is the tick before the first interval fires: a live quote must
  // not read as expired for one frame, so treat "not yet ticked" as not expired.
  const isExpired = quote !== null && now !== 0 && msLeft <= 0;
  const isExpiring = quote !== null && !isExpired && secondsLeft <= QUOTE_WARNING_SECONDS;

  const refresh = useCallback(async (): Promise<Quote | null> => {
    if (!request) return null;
    return fetchQuote(request);
  }, [request, fetchQuote]);

  const clear = useCallback(() => {
    sequence.current += 1;
    setQuote(null);
    setStatus('idle');
    setError(null);
    setErrorStatus(null);
  }, []);

  return {
    quote,
    status,
    isLoading: status === 'loading',
    error,
    errorStatus,
    expiresAt,
    msLeft,
    secondsLeft,
    isExpired,
    isExpiring,
    refresh,
    clear,
  };
}
