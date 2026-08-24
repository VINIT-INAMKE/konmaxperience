'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Menu, Search } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import {
  STOREFRONT_ACCOUNT_NAV,
  STOREFRONT_PRIMARY_NAV,
  navHrefs,
  resolveActiveNavHref,
  type StorefrontNavSection,
} from './nav-model';

/**
 * The nav below `md`, where the two header rows collapse into one.
 *
 * The desktop mega-menu does not shrink well — a popover anchored to a chevron
 * inside a 56px bar is a hit-target problem, not a layout problem — so the small
 * screen gets a full sheet with the same model: the three primary links, the
 * brand-grouped categories, and the account destinations. Same data, a shape
 * that suits the width.
 */
export interface StorefrontMobileNavProps {
  sections: StorefrontNavSection[];
  className?: string;
}

export function StorefrontMobileNav({ sections, className }: StorefrontMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeHref = useMemo(
    () => resolveActiveNavHref(pathname, navHrefs(sections)),
    [pathname, sections],
  );

  const close = () => setOpen(false);

  const rowClass = (active: boolean) =>
    cn(
      'block rounded-lg px-3 py-2 text-sm transition-colors',
      'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
      active
        ? 'bg-brand-soft font-semibold text-ink-strong'
        : 'text-ink-subtle hover:bg-surface-raised hover:text-ink-strong',
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the storefront menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex size-9 items-center justify-center rounded-lg text-ink-subtle transition-colors',
          'hover:bg-surface-raised hover:text-ink-strong',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
          className,
        )}
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[19rem] max-w-[85vw] gap-0 overflow-y-auto p-0">
          <SheetHeader className="border-b border-line px-5 py-4">
            <SheetTitle className="text-base">Browse</SheetTitle>
            <SheetDescription className="text-xs">
              The kitchen, the pantry and everything we host.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-3 py-4">
            <ul className="space-y-0.5">
              {STOREFRONT_PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className={rowClass(activeHref === item.href)}
                  >
                    <span className="flex items-center gap-2">
                      {item.href === '/search' ? (
                        <Search className="size-4" aria-hidden="true" />
                      ) : null}
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {sections.map((section) => (
              <div key={section.brandId}>
                <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  {section.brandName ?? 'Catalogue'}
                </p>
                <ul className="space-y-0.5">
                  {section.categories.map((category) => {
                    const href = `/shop/${category.slug}`;
                    return (
                      <li key={category.id}>
                        <Link href={href} onClick={close} className={rowClass(activeHref === href)}>
                          {category.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <div>
              <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Your account
              </p>
              <ul className="space-y-0.5">
                {STOREFRONT_ACCOUNT_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className={rowClass(activeHref === null && pathname === item.href)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
