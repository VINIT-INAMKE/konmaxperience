import { Star } from 'lucide-react';

import type { ProductReview } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

/**
 * The rating headline: the average, the count, and how the loaded reviews are
 * spread across the five stars.
 *
 * **`rating_avg` is `null`, not `0`, for an unrated product** — the backend
 * keeps "nobody has said anything" and "everyone said one star" distinguishable,
 * and so does this component: a `null` average renders the invitation, never a
 * zero-star headline.
 *
 * **The distribution is honest about its sample.** `GET /catalog/products/:id/reviews`
 * returns rows, not a histogram, so the bars are computed from the reviews the
 * page has actually loaded. When the product has more published reviews than
 * that, the caption says so rather than implying the bars describe all of them.
 * The average and the count always come from the product's own rollup
 * (maintained in both the service transaction and a DB trigger), so the number
 * a customer reads is never a partial average.
 */
export interface ReviewSummaryProps {
  ratingAvg: number | null;
  ratingCount: number;
  /** The reviews rendered on the page — the sample the bars describe. */
  reviews: readonly ProductReview[];
  className?: string;
}

export interface StarsProps {
  /** 0–5; fractional values render a partially filled star. */
  value: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STAR_SIZE: Record<NonNullable<StarsProps['size']>, string> = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
};

/**
 * Five stars with a clipped overlay, so `4.3` looks like `4.3` rather than
 * rounding to a number the customer can see is wrong next to the printed
 * average.
 */
export function Stars({ value, size = 'md', className }: StarsProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const sizeClass = STAR_SIZE[size];

  return (
    <span
      data-slot="stars"
      className={cn('relative inline-flex shrink-0', className)}
      aria-hidden="true"
    >
      <span className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(sizeClass, 'text-line-strong')} />
        ))}
      </span>
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
      >
        <span className="flex gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(sizeClass, 'fill-gold text-gold')} />
          ))}
        </span>
      </span>
    </span>
  );
}

function distributionOf(reviews: readonly ProductReview[]): number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const review of reviews) {
    const index = Math.round(review.rating) - 1;
    if (index >= 0 && index < 5) buckets[index] += 1;
  }
  return buckets;
}

export function ReviewSummary({
  ratingAvg,
  ratingCount,
  reviews,
  className,
}: ReviewSummaryProps) {
  if (ratingCount === 0 || ratingAvg === null) {
    return (
      <div
        data-slot="review-summary"
        className={cn(
          'rounded-2xl border border-dashed border-line-warm bg-surface/60 px-5 py-6',
          className,
        )}
      >
        <p className="text-sm font-medium text-ink-strong">No reviews yet</p>
        <p className="mt-1 text-sm text-ink-muted">
          Reviews come from customers once their order has been delivered. Be the first to
          say how this one landed.
        </p>
      </div>
    );
  }

  const buckets = distributionOf(reviews);
  const sample = reviews.length;
  const isPartialSample = sample > 0 && sample < ratingCount;

  return (
    <div
      data-slot="review-summary"
      className={cn(
        'grid gap-6 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center',
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-3xl font-semibold tracking-tight text-ink-strong tabular-nums">
          {ratingAvg.toFixed(1)}
          <span className="text-base font-normal text-ink-faint"> / 5</span>
        </p>
        <Stars value={ratingAvg} size="md" />
        <p className="text-sm text-ink-muted">
          {ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      {sample > 0 ? (
        <div className="min-w-0 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = buckets[star - 1];
            const percent = sample === 0 ? 0 : Math.round((count / sample) * 100);
            return (
              <div key={star} className="flex items-center gap-2 text-xs text-ink-muted">
                <span className="w-8 shrink-0 tabular-nums">{star}★</span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className="block h-full rounded-full bg-gold"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right tabular-nums">{count}</span>
              </div>
            );
          })}
          {isPartialSample ? (
            <p className="pt-1 text-xs text-ink-faint">
              Spread shown across the {sample} most recent reviews.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
