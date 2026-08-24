import Image from 'next/image';
import Link from 'next/link';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';

import { AccountLink } from './AccountLink';
import { MiniCartTrigger } from './MiniCartTrigger';
import { StorefrontMobileNav } from './StorefrontMobileNav';
import { StorefrontNav } from './StorefrontNav';
import { loadStorefrontNav } from './nav-data';

/**
 * The storefront chrome (`STORE-04`, SPEC §5.1) — **desktop is designed, not
 * stretched.**
 *
 * What it replaces: a single 56px bar carrying a logo and one "Account" link,
 * which was a phone layout widened to 1440px. What it is now:
 *
 * - a **utility row** (`md` and up) for the things that are true on every page
 *   but never the reason someone came — the brand promise, order tracking, and
 *   the identity slot with its loyalty balance;
 * - a **main row** carrying the logo, the primary nav with its brand-grouped
 *   category menu, a search affordance sized like a real field on `lg`, and the
 *   mini-cart trigger.
 *
 * Below `md` the two rows collapse to one and the nav moves into a sheet.
 *
 * This is a **server** component. The category data is fetched here, once, and
 * handed to the two nav components as props; the only client code in the header
 * is the nav's active state, the identity slot and the cart button.
 */
const BRAND_PROMISE = 'Cooked in the villa kitchen · shipped across India · every price includes GST';

const UTILITY_LINK_CLASS = cn(
  'rounded-md px-1.5 py-0.5 text-xs font-medium text-ink-subtle transition-colors',
  'hover:text-ink-strong',
  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
);

export async function StorefrontHeader() {
  const sections = await loadStorefrontNav();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur supports-backdrop-filter:bg-bg/75">
      {/* ── Utility row ─────────────────────────────────────────────────── */}
      <div className="hidden border-b border-line/70 bg-surface/70 md:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <p className="truncate text-xs text-ink-muted">{BRAND_PROMISE}</p>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/account/orders" className={UTILITY_LINK_CLASS}>
              Track an order
            </Link>
            <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
            <AccountLink />
          </div>
        </div>
      </div>

      {/* ── Main row ────────────────────────────────────────────────────── */}
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6 md:h-16 lg:px-8">
        <StorefrontMobileNav sections={sections} className="-ml-1.5 md:hidden" />

        <Link
          href="/"
          className={cn(
            'flex shrink-0 items-center gap-2.5 rounded-lg py-1 pr-2',
            'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
          )}
        >
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            priority
            style={{ height: '2rem', width: 'auto' }}
          />
          <span className="text-sm font-bold tracking-tight text-ink-strong sm:text-base">
            Konma Xperience
          </span>
        </Link>

        <StorefrontNav sections={sections} className="ml-4 hidden md:flex lg:ml-8" />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/* On lg the search affordance is field-shaped, because that is what a
              customer reaches for; the real input lives on /search (Task 5). */}
          <Link
            href="/search"
            className={cn(
              'hidden h-9 w-56 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-faint transition-colors lg:flex xl:w-72',
              'hover:border-brand/40 hover:text-ink-muted',
              'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
            )}
          >
            <Search className="size-4" aria-hidden="true" />
            <span>Search the shop</span>
          </Link>
          <Link
            href="/search"
            aria-label="Search the shop"
            className={cn(
              'flex size-9 items-center justify-center rounded-lg text-ink-subtle transition-colors lg:hidden',
              'hover:bg-surface-raised hover:text-ink-strong',
              'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
            )}
          >
            <Search className="size-5" aria-hidden="true" />
          </Link>

          <MiniCartTrigger showLabel />
        </div>
      </div>
    </header>
  );
}
