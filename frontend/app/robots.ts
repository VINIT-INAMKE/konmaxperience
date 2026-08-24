import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo/metadata';

/**
 * `/robots.txt` (`STORE-01`).
 *
 * Three rules govern what is in each list:
 *
 * 1. **Allow what a stranger can buy from.** `/`, `/shop`, `/p`, `/experiences`
 *    and `/search` render the same HTML for everyone, carry `generateMetadata`
 *    and appear in the sitemap. They are the whole indexable surface.
 * 2. **Disallow what belongs to one person.** A cart, a checkout, an account, an
 *    order's tracking page and a feedback form are all session-scoped: the URL
 *    is either useless to anyone else or actively private. Every one of those
 *    routes *also* ships `robots: { index: false }` in its metadata, and that is
 *    the load-bearing half — `Disallow` stops the crawl, `noindex` stops the
 *    listing, and a URL that is only disallowed can still be indexed from an
 *    inbound link. The audit in this task's report checks both.
 * 3. **Disallow the whole staff application.** Every `(ops)` and `(auth)`
 *    segment sits behind `proxy.ts`, so a crawler gets a redirect to the login
 *    form rather than content — but naming them keeps the crawl budget on the
 *    storefront and stops the sign-in page competing with `/shop` in a
 *    site: search.
 *
 * The `sitemap` pointer is absolute because the spec requires it: a relative
 * path in `robots.txt` is not a valid sitemap reference.
 */

/**
 * The customer-facing paths that exist but must never rank. Prefixes, so
 * `/account/orders/x` and `/orders/x/track` are covered by their parents.
 */
const PRIVATE_STOREFRONT_PATHS = [
  '/cart',
  '/checkout',
  '/account',
  '/orders',
  '/feedback',
  '/login',
];

/**
 * Every top-level segment of the staff application — the `(ops)` route group
 * plus the `(auth)` sign-in flow and `/team`, which `proxy.ts` rewrites onto it.
 *
 * Kept as an explicit list rather than a wildcard because `robots.txt` has no
 * "everything except" operator, and an accidental `Disallow: /` would take the
 * storefront down with it.
 */
const OPS_PATHS = [
  '/activity',
  '/admin',
  '/approvals',
  '/boards',
  '/chat',
  '/customers',
  '/dashboard',
  '/decisions',
  '/guide',
  '/intelligence',
  '/kpis',
  '/leaderboard',
  '/missions',
  '/notifications',
  '/operations',
  '/pos',
  '/promotions',
  '/quests',
  '/readiness',
  '/reviews',
  '/shipments',
  '/tasks',
  '/team',
  '/team-contribution',
  '/sign-in',
  '/forgot-password',
  '/set-password',
  '/reset-password',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/shop', '/p', '/experiences', '/search'],
        disallow: [...PRIVATE_STOREFRONT_PATHS, ...OPS_PATHS],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/').replace(/\/$/, ''),
  };
}
