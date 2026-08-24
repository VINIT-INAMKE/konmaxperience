'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  MapPin,
  Package,
  Settings,
  Sparkles,
  Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { resolveActiveNavHref } from '@/components/storefront/shell/nav-model';
import { cn } from '@/lib/utils';

export interface AccountNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The account area's own destinations.
 *
 * Deliberately a superset of `STOREFRONT_ACCOUNT_NAV` in the shell's
 * `nav-model.ts` (P5b Task 4's file, which this task does not edit): the shell
 * advertises the five customer-facing surfaces in the header menu, while the
 * account area also owns **Preferences** — consent and sign-out — which has no
 * business in a header dropdown.
 */
export const ACCOUNT_NAV: readonly AccountNavItem[] = [
  { href: '/account', label: 'Overview', icon: CreditCard },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/loyalty', label: 'Loyalty', icon: Sparkles },
  { href: '/account/reviews', label: 'Reviews', icon: Star },
  { href: '/account/preferences', label: 'Preferences', icon: Settings },
] as const;

const ACCOUNT_NAV_HREFS = ACCOUNT_NAV.map((item) => item.href);

/**
 * Left rail on `md` and up, a horizontal scrolling tab strip below it.
 *
 * Active state runs through the shell's `resolveActiveNavHref` — the same
 * longest-prefix rule the storefront nav uses — so `/account/orders/abc` lights
 * **Orders** and not **Overview**, which a bare `startsWith('/account')` would
 * get wrong for every child route.
 */
export function AccountNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const active = resolveActiveNavHref(pathname, ACCOUNT_NAV_HREFS);

  return (
    <nav aria-label="Account" className={className}>
      {/* Below md: a scrolling tab strip. */}
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:hidden">
        {ACCOUNT_NAV.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active === item.href ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
                active === item.href
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line text-ink-muted hover:border-line-strong hover:text-ink-strong',
              )}
            >
              <item.icon className="size-3.5" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* md and up: the left rail. */}
      <ul className="hidden md:flex md:flex-col md:gap-0.5">
        {ACCOUNT_NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active === item.href ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
                active === item.href
                  ? 'bg-brand-soft font-medium text-brand'
                  : 'text-ink-muted hover:bg-surface-raised hover:text-ink-strong',
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
