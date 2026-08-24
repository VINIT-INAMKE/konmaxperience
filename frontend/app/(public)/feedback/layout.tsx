import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { privateMetadata } from '@/lib/seo/metadata';

/**
 * Metadata-only layout for `/feedback/[orderId]` (P5b Task 13's indexability
 * audit).
 *
 * The page is a `'use client'` module and cannot export `metadata`, so the route
 * was emitting the root layout's `Konma Xperience OS` card and **no** `robots`
 * directive. It is `Disallow`ed in `robots.ts`, which stops the crawl but not
 * the listing — and the URL carries an order id, so a listed one would put a
 * customer's order reference in a search result.
 *
 * Placed on the `feedback` segment rather than on `[orderId]` so it covers the
 * whole branch, and it returns `children` untouched: the route's rendering and
 * its thank-you hand-off to `/account/reviews` are unchanged. Same shape as
 * `app/(public)/account/layout.tsx`.
 */
export const metadata: Metadata = privateMetadata(
  'Leave feedback',
  'Tell us how your Konma order went.',
);

export default function FeedbackLayout({ children }: { children: ReactNode }) {
  return children;
}
