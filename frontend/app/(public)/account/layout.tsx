import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { privateMetadata } from '@/lib/seo/metadata';

/**
 * `/account/*` — the signed-in surface (`ACCT-01`, `ACCT-02`).
 *
 * **This file stays a server component on purpose.** The guard and the nav live
 * in `AccountShell`, which every page under here wraps its content in, because
 * a client layout cannot export `metadata` and every account route must ship
 * `robots: noindex` — a search engine that indexed one of these would be
 * indexing an empty shell at best. Putting the guard one level down costs
 * nothing: the session is a shared module store, so all six routes read the one
 * profile request the tab already made.
 */
export const metadata: Metadata = privateMetadata(
  'Your account',
  'Orders, addresses, loyalty and reviews.',
);

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
