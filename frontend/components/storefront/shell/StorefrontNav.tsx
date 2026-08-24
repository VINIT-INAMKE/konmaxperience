'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import {
  STOREFRONT_PRIMARY_NAV,
  navHrefs,
  resolveActiveNavHref,
  type StorefrontNavSection,
} from './nav-model';

/**
 * The desktop primary nav: `Shop` (with a brand-grouped category menu),
 * `Experiences` and `Search`.
 *
 * A client component for exactly one reason — `usePathname` for the active
 * state. The category data is fetched on the **server** by `nav-data.ts` and
 * arrives as a prop, so nothing about the catalogue crosses into the client
 * bundle beyond the strings the menu draws.
 *
 * "Shop" is a link *and* a menu: the label navigates to `/shop`, the chevron
 * beside it opens the categories. Folding both into one popover trigger would
 * make the section header unreachable by click, which is the classic mega-menu
 * regression.
 */
export interface StorefrontNavProps {
  sections: StorefrontNavSection[];
  className?: string;
}

function navLinkClass(active: boolean): string {
  return cn(
    'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
    active
      ? 'text-ink-strong after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand'
      : 'text-ink-subtle hover:bg-surface-raised hover:text-ink-strong',
  );
}

export function StorefrontNav({ sections, className }: StorefrontNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeHref = useMemo(
    () => resolveActiveNavHref(pathname, navHrefs(sections)),
    [pathname, sections],
  );

  const shopActive = activeHref !== null && activeHref.startsWith('/shop');
  const hasCategories = sections.length > 0;

  return (
    <nav aria-label="Storefront" className={cn('items-center gap-0.5', className)}>
      <div className="flex items-center">
        <Link href="/shop" className={navLinkClass(shopActive)}>
          Shop
        </Link>
        {hasCategories ? (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger
              aria-label="Browse categories"
              className={cn(
                'flex size-7 items-center justify-center rounded-lg text-ink-muted transition-colors',
                'hover:bg-surface-raised hover:text-ink-strong',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
                'aria-expanded:bg-surface-raised aria-expanded:text-ink-strong',
              )}
            >
              <ChevronDown
                className={cn('size-4 transition-transform', menuOpen && 'rotate-180')}
                aria-hidden="true"
              />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={14}
              className="w-auto min-w-[22rem] max-w-[min(46rem,calc(100vw-3rem))] gap-0 p-0"
            >
              <div
                className={cn(
                  'grid gap-x-8 gap-y-6 p-5',
                  sections.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1',
                )}
              >
                {sections.map((section) => (
                  <div key={section.brandId} className="min-w-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      {section.brandName ?? 'Catalogue'}
                    </p>
                    <ul className="space-y-0.5">
                      {section.categories.map((category) => {
                        const href = `/shop/${category.slug}`;
                        return (
                          <li key={category.id}>
                            <Link
                              href={href}
                              onClick={() => setMenuOpen(false)}
                              className={cn(
                                'block truncate rounded-md px-2 py-1.5 text-sm transition-colors',
                                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
                                activeHref === href
                                  ? 'bg-brand-soft font-medium text-ink-strong'
                                  : 'text-ink-subtle hover:bg-surface-raised hover:text-ink-strong',
                              )}
                            >
                              {category.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="border-t border-line bg-surface-raised/60 px-5 py-3">
                <Link
                  href="/shop"
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
                >
                  Everything in the shop
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {STOREFRONT_PRIMARY_NAV.filter((item) => item.href !== '/shop').map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={navLinkClass(activeHref === item.href)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
