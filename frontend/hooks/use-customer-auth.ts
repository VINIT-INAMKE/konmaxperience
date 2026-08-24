'use client';

/**
 * The customer session — **one** per tab, not one per component.
 *
 * ## What was wrong before
 *
 * `useCustomerAuth` held `customer` in `useState` with a per-mount `useRef`
 * dedupe. Every consumer therefore owned a private copy of the session and its
 * own `GET /customer-auth/profile`: the header's identity slot, the mini-cart,
 * `use-cart`, the OTP form and every account page each put a request on the
 * wire and each answered "who is signed in?" differently. `hooks/use-cart.ts`
 * says so in its own comment — *"`useCustomerAuth` holds its session in
 * component state with no shared context, so a consumer that never calls
 * `fetchProfile` sees `customer` as `null` forever"* — and worked around it with
 * a mount effect. That workaround is now redundant but harmless.
 *
 * Worse than the traffic: sign-in did not propagate. `verifyOtp` in one subtree
 * left every other subtree's `customer` at `null`, so the cart could not merge
 * and the header still said "Sign in" until a full navigation.
 *
 * ## Why a module store rather than a React context
 *
 * A provider would have to be mounted above every consumer, and the only common
 * ancestor is `app/(public)/layout.tsx` — a **server** component owned by P5b
 * Task 4, which this task may not edit, and which must stay a server component
 * (its own doc comment makes that a checked property). A module-scoped store
 * read through `useSyncExternalStore` needs no ancestor at all: it is shared by
 * construction, works in the ops tree and the storefront alike, and keeps the
 * hook's public shape unchanged so no existing consumer has to move.
 *
 * The store is deliberately plain (a `Set` of listeners and one frozen state
 * object) rather than a second zustand store: the cart already owns the
 * persisted zustand store, and a session that must never outlive the tab has no
 * business being persisted next to it.
 *
 * ## The single flight
 *
 * `loadCustomerProfile()` resolves the session at most once per tab. Concurrent
 * callers share one in-flight promise; callers after it settles get the cached
 * answer, including the **negative** one — an anonymous visitor costs exactly
 * one `401`, never one per mounted component. `refreshCustomerProfile()` is the
 * explicit way past the cache, for the places that changed the profile.
 */

import { useSyncExternalStore } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Customer, VerifyOtpResponse } from '@/lib/types/customer-auth';

/**
 * `GET /customer-auth/profile`'s `PROFILE_SELECT`: the `Customer` fields plus
 * the consent flag P5b Task 2 added (`ACCT-01`).
 *
 * `marketing_opt_in` is optional because `POST /customer-auth/verify-otp`
 * answers with the narrower `{ id, phone, name }` shape and the session adopts
 * that immediately, before the follow-up profile read lands. A surface that
 * renders the toggle must therefore wait for {@link CustomerSession.isResolved}
 * rather than reading `?? false` and drawing a switch that is off because
 * nobody has asked yet.
 */
export interface CustomerProfile extends Customer {
  marketing_opt_in?: boolean;
}

export interface CustomerSession {
  customer: CustomerProfile | null;
  /** A profile request is on the wire right now. */
  isLoading: boolean;
  /** The session has settled at least once. `customer === null` only means "signed out" once this is `true`. */
  isResolved: boolean;
}

/** What a customer may change about themselves (`PATCH /customer-auth/profile`). */
export interface UpdateCustomerProfilePayload {
  name?: string;
  email?: string;
  marketing_opt_in?: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();

let session: CustomerSession = {
  customer: null,
  isLoading: false,
  isResolved: false,
};

/**
 * The snapshot handed to `useSyncExternalStore` during SSR and hydration.
 *
 * It must be a **stable module constant**: React calls `getServerSnapshot` on
 * every render of the first client pass, and a fresh object each time is an
 * infinite re-render. The server never knows the session — the cookie is
 * `httpOnly` and every account surface is a client guard — so "unresolved,
 * signed out" is the honest server answer.
 */
const SERVER_SESSION: CustomerSession = {
  customer: null,
  isLoading: false,
  isResolved: false,
};

function emit(): void {
  for (const listener of listeners) listener();
}

function patchSession(patch: Partial<CustomerSession>): void {
  session = { ...session, ...patch };
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CustomerSession {
  return session;
}

function getServerSnapshot(): CustomerSession {
  return SERVER_SESSION;
}

/** The current session without subscribing — for event handlers and non-React code. */
export function getCustomerSession(): CustomerSession {
  return session;
}

/** Adopt a customer the caller already has (the OTP verify response, a profile write). */
export function setCustomerSession(customer: CustomerProfile | null): void {
  patchSession({ customer, isLoading: false, isResolved: true });
}

/** Forget the session and allow the next {@link loadCustomerProfile} to ask the server again. */
export function clearCustomerSession(): void {
  inFlight = null;
  patchSession({ customer: null, isLoading: false, isResolved: false });
}

let inFlight: Promise<CustomerProfile | null> | null = null;

/**
 * Resolve the session, once per tab.
 *
 * Never throws and never rejects: a `401`/`403` from the profile route is the
 * ordinary answer for a visitor with no cookie, and every caller — the header,
 * the cart, an account guard — wants "signed out", not an exception.
 */
export function loadCustomerProfile(): Promise<CustomerProfile | null> {
  if (session.isResolved) return Promise.resolve(session.customer);
  if (inFlight) return inFlight;
  return refreshCustomerProfile();
}

/** Re-read the profile past the cache. Used after a write and after sign-in. */
export function refreshCustomerProfile(): Promise<CustomerProfile | null> {
  patchSession({ isLoading: true });
  const request = apiClient
    .get<CustomerProfile>('/customer-auth/profile')
    .then((profile) => {
      patchSession({ customer: profile, isLoading: false, isResolved: true });
      return profile;
    })
    .catch(() => {
      patchSession({ customer: null, isLoading: false, isResolved: true });
      return null;
    });

  inFlight = request;
  void request.finally(() => {
    if (inFlight === request) inFlight = null;
  });
  return request;
}

export function sendCustomerOtp(phone: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/customer-auth/send-otp', { phone });
}

/**
 * Verify the OTP and publish the session to every subscriber.
 *
 * **The guest-cart merge is deliberately not here.** It used to be — this hook
 * posted `/customer/cart/sync` inline — but P5b Task 8 owns that step as
 * `useCart().mergeGuestCart()`, which reconciles the store with what the server
 * answers instead of trusting the local copy. Two writers on one endpoint would
 * race on the login path, so the sign-in surface calls `mergeGuestCart()` once
 * the session has propagated (see `app/(public)/login/page.tsx`).
 *
 * The verify response carries only `{ id, phone, name }`, so a background
 * refresh fills in `email` and `marketing_opt_in` without blocking the redirect.
 */
export async function verifyCustomerOtp(
  phone: string,
  otp: string,
): Promise<VerifyOtpResponse> {
  const result = await apiClient.post<VerifyOtpResponse>(
    '/customer-auth/verify-otp',
    { phone, otp },
  );
  setCustomerSession(result.customer);
  void refreshCustomerProfile();
  return result;
}

export async function updateCustomerProfile(
  data: UpdateCustomerProfilePayload,
): Promise<CustomerProfile> {
  const updated = await apiClient.patch<CustomerProfile>(
    '/customer-auth/profile',
    data,
  );
  setCustomerSession(updated);
  return updated;
}

/**
 * `ACCT-02` — server-side `jti` revocation plus the cookie clear.
 *
 * The local session is dropped **whatever the server says**: a failed logout
 * must not leave the UI claiming the customer is still signed in when the
 * intent was the opposite.
 */
export async function logoutCustomer(): Promise<void> {
  try {
    await apiClient.post('/customer-auth/logout', {});
  } finally {
    clearCustomerSession();
  }
}

/**
 * Read the shared session.
 *
 * The returned actions are module functions, so their identities are stable for
 * the life of the tab — an effect with `[fetchProfile]` in its dependency array
 * runs exactly once, which the previous `useCallback([customer])` version could
 * not promise.
 */
export function useCustomerAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    customer: state.customer,
    isLoading: state.isLoading,
    /** `true` once the session has settled — distinguishes "signed out" from "not asked yet". */
    isResolved: state.isResolved,
    fetchProfile: loadCustomerProfile,
    refreshProfile: refreshCustomerProfile,
    sendOtp: sendCustomerOtp,
    verifyOtp: verifyCustomerOtp,
    updateProfile: updateCustomerProfile,
    logout: logoutCustomer,
  };
}
