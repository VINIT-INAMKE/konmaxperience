'use client';

/**
 * The reviews this customer has written (`GET /customers/:id` → `reviews`).
 *
 * Deliberately **not** a moderation surface: `PATCH /reviews/:id/publish|hide`
 * belongs to `/reviews`, where a moderator sees the whole queue and the effect
 * on the product's rating. Acting on one review from inside a customer profile
 * would hide that context, so this panel shows status and links no further.
 *
 * `media` is an array of public CDN URLs; the count is shown rather than the
 * images because a staff member scanning a profile wants the shape of the
 * history, and the moderation screen is where the photographs matter.
 */

import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import { formatDateTime } from '@/lib/format/date';
import { REVIEW_STATUS_LABELS, type ReviewStatus } from '@/lib/types/reviews';
import type { CustomerDetailReview } from '@/lib/types/customers';
import { PanelEmpty, PanelHeading } from '@/components/ops/customers/CustomerPanel';

const STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: STATUS_BADGE.warning,
  published: STATUS_BADGE.good,
  hidden: STATUS_BADGE.neutral,
};

const MAX_RATING = 5;

function StarRating({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(MAX_RATING, Math.round(rating)));
  return (
    <span
      className="flex items-center gap-0.5 text-gold-text"
      aria-label={`${filled} out of ${MAX_RATING}`}
    >
      {Array.from({ length: MAX_RATING }).map((_, index) => (
        <Star
          key={index}
          className={index < filled ? 'size-3.5 fill-current' : 'size-3.5 opacity-30'}
          aria-hidden
        />
      ))}
    </span>
  );
}

interface CustomerReviewsPanelProps {
  reviews: CustomerDetailReview[];
  /** `_count.reviews` — the real lifetime total, which `reviews` truncates. */
  totalReviews: number;
}

export function CustomerReviewsPanel({
  reviews,
  totalReviews,
}: CustomerReviewsPanelProps) {
  if (reviews.length === 0) {
    return (
      <PanelEmpty
        icon={Star}
        title="No reviews written"
        description="A customer can only review a product they have actually received or attended, so a new customer has none."
      />
    );
  }

  return (
    <div className="space-y-3">
      <PanelHeading
        title={`${reviews.length} of ${totalReviews} reviews`}
        hint="Moderate these from the Reviews queue, where the effect on the product rating is visible."
      />

      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium">{review.product.name}</p>
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(review.created_at)}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className={STATUS_STYLES[review.status]}>
                {REVIEW_STATUS_LABELS[review.status]}
              </Badge>
            </div>

            {review.title && (
              <p className="mt-3 text-sm font-medium">{review.title}</p>
            )}
            {review.body && (
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                {review.body}
              </p>
            )}
            {review.media.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {review.media.length}{' '}
                {review.media.length === 1 ? 'photo attached' : 'photos attached'}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
