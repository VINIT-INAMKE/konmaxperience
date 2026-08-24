import type { ReactNode } from 'react';

import { StorefrontFooter } from '@/components/storefront/shell/StorefrontFooter';
import { StorefrontHeader } from '@/components/storefront/shell/StorefrontHeader';

/**
 * The storefront shell (`STORE-04`).
 *
 * **`className="light"` is load-bearing, not decoration.** `lib/providers.tsx`
 * runs next-themes with `defaultTheme="system"`, so a visitor whose OS is dark
 * gets `<html class="dark">` and the semantic layer would inherit straight
 * through this wrapper. P5b Task 3 made `.light` a real selector in
 * `app/tokens.css` (`:root, .light`), so this class now re-declares the light
 * values on the element itself and beats the ancestor `.dark` by proximity. The
 * storefront has no theme toggle — SPEC §1.3 freezes the homepage light and
 * makes its palette the brand's source of truth — so pinning is the whole
 * point, and removing this class silently reintroduces the three-way light/dark
 * mix Sweep D flagged.
 *
 * **This file must stay a server component.** The header fetches the category
 * menu on the server and the only client code under it is the nav's active
 * state, the identity slot and the cart button. A client directive at the top of
 * this file would drag every storefront page into the client bundle — Task 4's
 * verification greps for one, so the absence is checked, not merely intended.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="light flex min-h-screen flex-col bg-bg text-ink">
      <a
        href="#storefront-main"
        className="sr-only rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <StorefrontHeader />

      <main id="storefront-main" className="flex-1">
        {/* The content well every storefront route renders into. Wave 2 pages
            supply their own vertical rhythm inside it and never re-declare the
            horizontal gutter, so the whole storefront lines up on one grid. */}
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
}
