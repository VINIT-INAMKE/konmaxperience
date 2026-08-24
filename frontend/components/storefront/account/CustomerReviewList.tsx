'use client';

import Link from 'next/link';
import { MessageSquare, Star } from 'lucide-react';

import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';
import { formatDate } from '@/lib/format/date';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { CustomerReview, ReviewStatus } from '@/lib/types/reviews';
import { cn } from '@/lib/utils';

/**
 * What the customer has already written.
 *
 * **Moderation is stated, not hidden.** A review sits `pending` until a
 * moderator publishes it, and a moderator may `hide` one later. Showing every
 * review as if it were live would leave someone puzzled that their words are
 * nowhere on the product page; each of the three states therefore gets its own
 * sentence, in the customer's terms rather than the database's.
 */
const STATUS_COPY: Record<ReviewStatus, { label: string; note: string; badge: string }> = {
  published: {
    label: 'Published',
    note: 'Live on the product page.',
    badge: STATUS_BADGE.good,
  },
  pending: {
    label: 'Awaiting moderation',
    note: 'A moderator reads every review before it goes live.',
    badge: STATUS_BADGE.warning,
  },
  hidden: {
    label: 'Not shown',
    note: 'A moderator has taken this one off the product page.',
    badge: STATUS_BADGE.neutral,
  },
};

export function CustomerReviewList({ reviews }: { reviews: CustomerReview[] }) {
  if (reviews.length === 0) {
    return (
      <StorefrontEmpty
        density="inline"
        icon={MessageSquare}
        title="You have not written a review yet"
        description="Anything delivered or attended can be reviewed from the list above."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review) => {
        const copy = STATUS_COPY[review.status];
        return (
          <li
            key={review.id}
            className="space-y-2 rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Link
                  href={`/p/${review.product.slug}`}
                  className="text-sm font-medium text-ink-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
                >
                  {review.product.name}
                </Link>
                <p
                  className="flex items-center gap-0.5"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      aria-hidden="true"
                      className={cn(
                        'size-3.5',
                        star <= review.rating
                          ? 'fill-[var(--gold)] text-[var(--gold)]'
                          : 'fill-none text-ink-faint',
                      )}
                    />
                  ))}
                  <span className="ml-2 text-xs text-ink-faint">
                    {formatDate(review.created_at)}
                  </span>
                </p>
              </div>

              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                  copy.badge,
                )}
              >
                {copy.label}
              </span>
            </div>

            {review.title ? (
              <p className="text-sm font-medium text-ink-strong">{review.title}</p>
            ) : null}
            {review.body ? (
              <p className="text-sm text-ink-muted">{review.body}</p>
            ) : null}

            <p className="text-xs text-ink-faint">{copy.note}</p>
          </li>
        );
      })}
    </ul>
  );
}
