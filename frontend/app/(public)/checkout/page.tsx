import type { Metadata } from 'next';

import { CheckoutFlow } from '@/components/storefront/checkout/CheckoutFlow';

/**
 * `/checkout` — the money path (`STORE-02`, plan Task 10).
 *
 * The **page** is a server component purely so this `metadata` export can exist;
 * everything below it is client code, because the quote, its countdown, the
 * Razorpay modal and the confirm round trip are all live state. `robots` is
 * written out longhand rather than through `privateMetadata`, so the Task 13
 * indexability audit — which greps every storefront `page.tsx` — can see it.
 *
 * Nothing here is worth ranking anyway: the checkout is behind a customer
 * session and has no stable public URL.
 */
export const metadata: Metadata = {
  title: 'Checkout — Konma',
  description: 'Review your order and pay securely.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function CheckoutPage() {
  return <CheckoutFlow />;
}
