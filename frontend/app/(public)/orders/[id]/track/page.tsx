import type { Metadata } from 'next';

import { privateMetadata } from '@/lib/seo/metadata';

import { TrackClient } from './TrackClient';

/**
 * `/orders/[id]/track` — the customer's view of one order (`STORE-03`).
 *
 * **This file is a server component and its body is a client one.** The data is
 * customer-scoped and live, so it cannot be fetched on the server (the request
 * carries no `customer_token` here) and cannot be cached — that is `TrackClient`'s
 * job. What the server shell buys is the `metadata` export: `robots: index:false`
 * has to live on a *route* module, and a `'use client'` file cannot export one.
 * A customer's order must never be indexed, so the shell exists for that.
 *
 * `proxy.ts` lists `/orders` in `PUBLIC_PATHS` (P5b decision 9), so an anonymous
 * visitor reaches this route rather than being bounced to the staff login; the
 * `401` from `GET /customer/orders/:id` is what turns into a sign-in prompt.
 */
export const metadata: Metadata = privateMetadata(
  'Track your order',
  'Live progress for your Konma order — kitchen, parcel and bookings.',
);

interface TrackPageProps {
  params: Promise<{ id: string }>;
  /** `?placed=1` is the checkout hand-off's acknowledgement flag. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrderTrackPage({ params, searchParams }: TrackPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  return <TrackClient orderId={id} justPlaced={query.placed === '1'} />;
}
