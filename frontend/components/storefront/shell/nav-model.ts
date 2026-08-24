/**
 * The storefront navigation model — pure data and pure functions, no fetching.
 *
 * Kept apart from `nav-data.ts` on purpose: `StorefrontNav` and the mobile sheet
 * are client components and import the primary links and the active-state
 * resolver at runtime, while the category fetch must never cross into the client
 * bundle.
 */

/** One brand's slice of the Shop menu. `brandName` is `null` when `GET /brands` was unreachable. */
export interface StorefrontNavCategory {
  id: string;
  name: string;
  slug: string;
}

export interface StorefrontNavSection {
  brandId: string;
  brandName: string | null;
  categories: StorefrontNavCategory[];
}

export interface StorefrontNavItem {
  href: string;
  label: string;
}

/**
 * The three primary destinations (SPEC §5.1). `/menu` and `/events` are
 * permanent redirects into `/shop?type=prepared_food` and `/experiences`
 * (Task 13), so they are deliberately absent here — the shell links to the
 * destinations, never to the redirect.
 */
export const STOREFRONT_PRIMARY_NAV: readonly StorefrontNavItem[] = [
  { href: '/shop', label: 'Shop' },
  { href: '/experiences', label: 'Experiences' },
  { href: '/search', label: 'Search' },
] as const;

/** The account destinations the shell offers. `/account` itself handles the signed-out case. */
export const STOREFRONT_ACCOUNT_NAV: readonly StorefrontNavItem[] = [
  { href: '/account', label: 'My account' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/loyalty', label: 'Loyalty' },
  { href: '/account/reviews', label: 'Reviews' },
] as const;

/** The pathname half of an `href` — `/shop?type=packaged` → `/shop`. */
export function navHrefPath(href: string): string {
  const cut = href.search(/[?#]/);
  return cut === -1 ? href : href.slice(0, cut);
}

/**
 * The one nav entry that owns `pathname`: the **longest** route prefix that
 * matches, mirroring `lib/nav/spine.ts`'s `resolveActiveHref`.
 *
 * Longest-match is what stops `/shop` lighting up while the visitor is on
 * `/shop/pantry` — the category link wins because its prefix is longer. A bare
 * `startsWith` would light both, and a strict equality check would light
 * neither once a category page is open.
 */
export function resolveActiveNavHref(
  pathname: string,
  hrefs: readonly string[],
): string | null {
  let best: string | null = null;
  let bestLength = -1;
  for (const href of hrefs) {
    const path = navHrefPath(href);
    if (pathname !== path && !pathname.startsWith(`${path}/`)) continue;
    if (path.length > bestLength) {
      best = href;
      bestLength = path.length;
    }
  }
  return best;
}

/** Every href the storefront nav can claim, primary links plus category links. */
export function navHrefs(sections: readonly StorefrontNavSection[]): string[] {
  return [
    ...STOREFRONT_PRIMARY_NAV.map((item) => item.href),
    ...sections.flatMap((section) =>
      section.categories.map((category) => `/shop/${category.slug}`),
    ),
  ];
}
