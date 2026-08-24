import { redirect } from 'next/navigation';

/**
 * `/profile` is retired. The account surface is `/account/*` (SPEC §5.1).
 *
 * **Why a route-level redirect and not a `next.config.ts` rule.** A permanent
 * redirect in the config is the right long-term home for this — and P5b Task 13
 * owns that file, alongside the `/menu` and `/events` rules it adds in the same
 * pass. This task must not edit it, so the retirement ships as a route that
 * redirects instead: same destination for a visitor, no config collision
 * between two agents, and Task 13 can lift it into `next.config.ts` and delete
 * this file when it lands.
 *
 * `redirect()` in a server component answers `307`. That is deliberate for the
 * interim: a `308` would be cached by the browser and would then survive the
 * move into `next.config.ts`, making the permanent rule impossible to change if
 * it ever needed to be.
 *
 * What used to live here — a 971-line page carrying identity, orders, addresses
 * and payment state — is now six focused routes:
 *
 * | old tab | new route |
 * |---|---|
 * | identity | `/account` · `/account/preferences` |
 * | orders | `/account/orders`, `/account/orders/[id]` |
 * | addresses | `/account/addresses` |
 * | — | `/account/loyalty`, `/account/reviews` |
 */
export default function ProfileRedirectPage() {
  redirect('/account');
}
