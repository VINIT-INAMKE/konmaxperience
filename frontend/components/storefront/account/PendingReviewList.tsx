'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PenLine, Star } from 'lucide-react';

import { ReviewComposer } from '@/components/storefront/account/ReviewComposer';
import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format/date';
import type { PendingReview } from '@/lib/types/reviews';

/**
 * The review invitations (`ACCT-02`).
 *
 * A line appears here once it is `delivered` (goods) or `attended` (an
 * experience) and has no review yet — the **item's** status, not the order's,
 * which is why an order with one shipped and one still-preparing line can
 * produce exactly one invitation.
 *
 * One composer is open at a time. Five open forms invite five half-finished
 * reviews, and the pending list is short by construction anyway.
 */
export function PendingReviewList({ pending }: { pending: PendingReview[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (pending.length === 0) {
    return (
      <StorefrontEmpty
        density="inline"
        icon={Star}
        title="Nothing waiting on a review"
        description="We ask for a review once something has been delivered or a workshop attended."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {pending.map((item) => (
        <li key={item.order_item_id}>
          {openId === item.order_item_id ? (
            <ReviewComposer pending={item} onDone={() => setOpenId(null)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
              <div className="min-w-0 space-y-1">
                <Link
                  href={`/p/${item.product.slug}`}
                  className="text-sm font-medium text-ink-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
                >
                  {item.product.name}
                </Link>
                <p className="text-xs text-ink-muted">
                  Order #{item.order.order_number} ·{' '}
                  {formatDate(item.order.created_at)}
                </p>
              </div>
              <Button size="sm" onClick={() => setOpenId(item.order_item_id)}>
                <PenLine className="size-3.5" aria-hidden="true" />
                Write a review
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
