'use client';

import { ExternalLink, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { STATUS_BADGE } from '@/lib/status-styles';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format/date';
import {
  REVIEW_STATUS_LABELS,
  type ModerationReview,
  type ReviewStatus,
} from '@/lib/types/reviews';
import { ModerateReviewButtons } from './ModerateReviewButtons';

const MAX_STARS = 5;
const STARS = [1, 2, 3, 4, 5];

const STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: STATUS_BADGE.warning,
  published: STATUS_BADGE.good,
  hidden: STATUS_BADGE.muted,
};

function StarRating({ rating }: { rating: number }) {
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} out of ${MAX_STARS} stars`}
    >
      {STARS.map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(
            'size-4',
            star <= rating ? 'fill-current text-gold' : 'text-ink-faint',
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium tabular-nums text-ink">
        {rating}
      </span>
    </span>
  );
}

/**
 * One row of the moderation queue.
 *
 * The product link points at the customer-facing page (`/p/[slug]`) and opens
 * in a new tab: a moderator's judgement usually depends on what the review sits
 * next to, and losing the queue's scroll position to check would be a poor
 * trade. It is a plain anchor rather than a `<Link>` precisely because it leaves
 * the ops app.
 */
export function ReviewCard({ review }: { review: ModerationReview }) {
  const customerName = review.customer.name?.trim();

  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        {/* Rating · status · when */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StarRating rating={review.rating} />
            <Badge variant="outline" className={STATUS_STYLES[review.status]}>
              {REVIEW_STATUS_LABELS[review.status]}
            </Badge>
            <span className="text-xs text-ink-muted">
              {formatDateTime(review.created_at)}
            </span>
          </div>
          <ModerateReviewButtons review={review} />
        </div>

        {/* Who, and about what */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <a
            href={`/p/${review.product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand underline-offset-4 hover:underline"
          >
            {review.product.name}
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">(opens the storefront page)</span>
          </a>
          <span className="text-ink-faint" aria-hidden>
            ·
          </span>
          <span className="text-ink-muted">
            {customerName ? `${customerName} · ` : ''}
            {review.customer.phone}
          </span>
        </div>

        {/* What they wrote */}
        {review.title && (
          <p className="text-sm font-medium text-ink">{review.title}</p>
        )}
        {review.body ? (
          <p className="text-sm whitespace-pre-line text-ink-muted">
            {review.body}
          </p>
        ) : (
          !review.title && (
            <p className="text-sm text-ink-faint">
              A rating with no words — nothing to read, only a score to accept or
              reject.
            </p>
          )
        )}

        {/* Attached photos */}
        {review.media.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {review.media.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block size-16 overflow-hidden rounded-md border border-line"
                >
                  {/* Review photos are arbitrary customer uploads; the ops app
                      renders them at thumbnail size straight from the CDN. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* Audit tail */}
        {review.moderated_at && (
          <p
            className="text-xs text-ink-faint"
            title={review.moderated_by ?? undefined}
          >
            Moderated {formatDateTime(review.moderated_at)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
