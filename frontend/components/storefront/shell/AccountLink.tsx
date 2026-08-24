'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sparkles, UserRound } from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import type { LoyaltySummary } from '@/lib/types/checkout';
import type { Customer } from '@/lib/types/customer-auth';
import { cn } from '@/lib/utils';

/**
 * The utility row's identity slot: "Sign in" for a visitor, the customer's first
 * name plus their points balance once we know who they are.
 *
 * **Why the requests are memoised at module scope:** this island renders in the
 * layout, so it mounts on every storefront navigation. A per-mount fetch would
 * put two requests on the wire for every page view. The promises below are
 * cached for the lifetime of the tab, so a signed-in customer costs two requests
 * per tab and an anonymous one costs a single 401/403 that is never retried.
 *
 * **Why every failure is silent:** `GET /customer-auth/profile` is one of the
 * six routes P5b Task 2 fixes — until that lands it answers `403` under the
 * global `PermissionsGuard` even for a signed-in customer. The header must
 * degrade to "Sign in" in that case, never to an error, and it must not block
 * the page it sits above.
 */
const SIGN_IN_HREF = '/login';

let profileRequest: Promise<Customer | null> | null = null;
let loyaltyRequest: Promise<LoyaltySummary | null> | null = null;

function loadProfile(): Promise<Customer | null> {
  profileRequest ??= apiClient
    .get<Customer>('/customer-auth/profile')
    .catch(() => null);
  return profileRequest;
}

function loadLoyalty(): Promise<LoyaltySummary | null> {
  loyaltyRequest ??= apiClient
    .get<LoyaltySummary>('/customer/loyalty')
    .catch(() => null);
  return loyaltyRequest;
}

function firstName(customer: Customer): string {
  const name = customer.name?.trim();
  if (!name) return 'My account';
  return name.split(/\s+/)[0];
}

export interface AccountLinkProps {
  className?: string;
}

export function AccountLink({ className }: AccountLinkProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const profile = await loadProfile();
      if (cancelled || !profile) return;
      setCustomer(profile);
      const loyalty = await loadLoyalty();
      if (cancelled || !loyalty) return;
      setPoints(loyalty.points_balance);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkClass = cn(
    'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors',
    'text-ink-subtle hover:text-ink-strong',
    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
    className,
  );

  if (!customer) {
    return (
      <Link href={SIGN_IN_HREF} className={linkClass}>
        <UserRound className="size-3.5" aria-hidden="true" />
        Sign in
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {points !== null && points > 0 ? (
        <span
          className="inline-flex items-center gap-1 text-xs text-gold-text"
          title="Loyalty points available to redeem at checkout"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{points.toLocaleString('en-IN')}</span>
          <span className="sr-only">loyalty </span>pts
        </span>
      ) : null}
      <Link href="/account" className={linkClass}>
        <UserRound className="size-3.5" aria-hidden="true" />
        {firstName(customer)}
      </Link>
    </span>
  );
}
