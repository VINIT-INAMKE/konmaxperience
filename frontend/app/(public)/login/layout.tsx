import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { privateMetadata } from '@/lib/seo/metadata';

/**
 * Metadata-only layout for `/login` (P5b Task 13's indexability audit).
 *
 * `page.tsx` is a `'use client'` module and a client module cannot export
 * `metadata`, so without this file the route inherited the root layout's card —
 * `Konma Xperience OS` — and emitted **no** `robots` directive at all. It was
 * `Disallow`ed in `robots.ts`, and that is not the same thing: `Disallow` stops
 * a crawler fetching the page, but a URL that is only disallowed can still be
 * listed from an inbound link, with the search engine inventing a title for it.
 * The customer sign-in form appearing in a `site:` search above the shop is a
 * real outcome of that, and `noindex` is the directive that prevents it.
 *
 * The layout returns `children` untouched, so the route's rendering, its
 * `Suspense` boundary and its `?redirect=` handling are all unchanged. It exists
 * for the export. This is the same shape `app/(public)/account/layout.tsx`
 * already uses for the six account routes, for the same reason.
 */
export const metadata: Metadata = privateMetadata(
  'Sign in',
  'Sign in to Konma with your phone number.',
);

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
