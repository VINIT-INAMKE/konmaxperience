'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { AccountNav } from '@/components/storefront/account/AccountNav';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

/**
 * The client guard and chrome for every `/account/*` route.
 *
 * **Why the whole surface hangs on one request.** The session lives in the
 * `httpOnly` `customer_token` cookie, so no server component can read it and no
 * page here can be rendered on the server behind an auth check. The guard is
 * therefore `GET /customer-auth/profile` on the client — the route P5b Task 2
 * fixed. Before that fix the global `PermissionsGuard` answered `403` for a
 * signed-in customer, the session never restored on refresh, and every account
 * page bounced straight back to `/login`. If that regresses, this is where it
 * shows first.
 *
 * The redirect carries `?redirect=<path>` so a deep link — `/account/loyalty`,
 * or an emailed `/account/orders/<id>` — survives the sign-in round trip.
 *
 * The session read is shared (`hooks/use-customer-auth.ts`), so mounting this
 * shell costs nothing beyond the one profile request the tab already made for
 * the header's identity slot.
 */
export interface AccountShellProps {
  title: string;
  description?: ReactNode;
  /** Rendered on the title row — a single action, not a toolbar. */
  action?: ReactNode;
  children: ReactNode;
}

export function AccountShell({
  title,
  description,
  action,
  children,
}: AccountShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { customer, isResolved, fetchProfile } = useCustomerAuth();

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!isResolved || customer) return;
    router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [isResolved, customer, pathname, router]);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10">
      <AccountNav className="md:w-52 md:shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">
              {title}
            </h1>
            {description ? (
              <p className="max-w-prose text-sm text-ink-muted">{description}</p>
            ) : null}
          </div>
          {action}
        </div>

        {/*
          Three states, not two. While the session is unresolved the page shows
          a skeleton; once resolved without a customer the redirect above is
          already in flight and rendering the signed-in content — even for a
          frame — would flash another customer's empty account at a visitor.
        */}
        {!isResolved || !customer ? (
          <StorefrontSkeleton variant="list" count={3} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
