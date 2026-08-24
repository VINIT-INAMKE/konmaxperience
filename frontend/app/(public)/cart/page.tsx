import type { Metadata } from 'next';

import { privateMetadata } from '@/lib/seo/metadata';

import { CartView } from './CartView';

/**
 * `/cart` (`STORE-02`).
 *
 * **This file is a server component and must stay one.** `metadata` cannot be
 * exported from a `'use client'` module, and a cart must not be indexed — it is
 * one person's basket, it changes every minute, and a search result pointing at
 * it is worse than useless. `privateMetadata` sets `robots: index:false,
 * follow:false` for both the default crawler and Googlebot.
 *
 * Everything with state lives in `CartView`.
 */
export const metadata: Metadata = privateMetadata(
  'Your cart',
  'Review what you have chosen from the villa kitchen, the pantry and the events calendar.',
);

export default function CartPage() {
  return <CartView />;
}
