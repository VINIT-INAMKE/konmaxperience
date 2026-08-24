import Image from 'next/image';
import Link from 'next/link';

import { PRODUCT_TYPE_LABELS } from '@/lib/types/catalog';
import { cn } from '@/lib/utils';

import { STOREFRONT_ACCOUNT_NAV } from './nav-model';
import { loadStorefrontNav } from './nav-data';

/**
 * The real footer, in place of the 40px "Powered by Konma Xperience" strip.
 *
 * A storefront footer is where the links that do not earn header space go and
 * still get found: the product-type entry points, the live categories, the
 * account surface, and the two facts a customer checks before paying — that
 * prices include GST, and that shipping and discounts are settled at checkout
 * (P5b decision 6, stated in the same words the cart uses so the two agree).
 *
 * Server component. `loadStorefrontNav()` is called again here rather than
 * threaded down from the layout: Next dedupes identical `fetch`es within one
 * render pass, so the header and the footer share a single request.
 */
const TYPE_LINKS = [
  { type: 'prepared_food', href: '/shop?type=prepared_food' },
  { type: 'packaged', href: '/shop?type=packaged' },
  { type: 'merchandise', href: '/shop?type=merchandise' },
] as const;

const FOOTER_LINK_CLASS = cn(
  'rounded-md text-sm text-ink-muted transition-colors',
  'hover:text-ink-strong',
  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
);

const COLUMN_TITLE_CLASS =
  'mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint';

export async function StorefrontFooter() {
  const sections = await loadStorefrontNav();
  const categories = sections.flatMap((section) => section.categories).slice(0, 6);

  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3 lg:pr-8">
            <Link
              href="/"
              className={cn(
                'flex items-center gap-2.5 rounded-lg',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
              )}
            >
              <Image
                src="/logo.png"
                alt=""
                width={32}
                height={32}
                style={{ height: '1.75rem', width: 'auto' }}
              />
              <span className="text-sm font-bold tracking-tight text-ink-strong">
                Konma Xperience
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
              One villa kitchen, one pantry and a calendar of things worth turning
              up for. Cooked to order, packed by hand, and shipped the same week.
            </p>
          </div>

          <nav aria-label="Shop">
            <h2 className={COLUMN_TITLE_CLASS}>Shop</h2>
            <ul className="space-y-2">
              <li>
                <Link href="/shop" className={FOOTER_LINK_CLASS}>
                  Everything
                </Link>
              </li>
              {TYPE_LINKS.map((entry) => (
                <li key={entry.type}>
                  <Link href={entry.href} className={FOOTER_LINK_CLASS}>
                    {PRODUCT_TYPE_LABELS[entry.type]}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/experiences" className={FOOTER_LINK_CLASS}>
                  Experiences
                </Link>
              </li>
              <li>
                <Link href="/search" className={FOOTER_LINK_CLASS}>
                  Search
                </Link>
              </li>
            </ul>
          </nav>

          {categories.length > 0 ? (
            <nav aria-label="Categories">
              <h2 className={COLUMN_TITLE_CLASS}>Categories</h2>
              <ul className="space-y-2">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link href={`/shop/${category.slug}`} className={FOOTER_LINK_CLASS}>
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <nav aria-label="Your account">
            <h2 className={COLUMN_TITLE_CLASS}>Your account</h2>
            <ul className="space-y-2">
              {STOREFRONT_ACCOUNT_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={FOOTER_LINK_CLASS}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/cart" className={FOOTER_LINK_CLASS}>
                  Cart
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© Konma Xperience. Made at the villa.</p>
          <p>
            All prices include GST. Shipping, coupons and loyalty are calculated at
            checkout.
          </p>
        </div>
      </div>
    </footer>
  );
}
