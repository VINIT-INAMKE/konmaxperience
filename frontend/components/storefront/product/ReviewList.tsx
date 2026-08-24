'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format/date';
import type { ProductReview, ProductReviewPage } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

import { Stars } from './ReviewSummary';

/**
 * The published reviews, paginated by the cursor the API hands back.
 *
 * **The first page is server-rendered and passed in.** Reviews are indexable
 * content and part of the product's JSON-LD, so they must exist in the server
 * HTML; this component only appends what comes after. That is also why it is the
 * single client island in the reviews section — nothing else here needs a
 * browser.
 *
 * **`next_cursor` is opaque** (P5b decision 21). It is passed back verbatim as
 * `?cursor=` and never parsed, so the same component works whether the backend
 * is handing out row ids or base64 offsets.
 *
 * **Raw `fetch`, not `apiClient`:** a `401` from `apiClient` clears the staff
 * auth store and navigates to `/team`. This route is `@Public()`, and a shopper
 * paging through reviews must never end up at the staff login.
 *
 * Only `customer.name` is ever shown — `PUBLIC_SELECT` in `reviews.service.ts`
 * gives nothing else, and a review with no name renders as an anonymous
 * verified buyer rather than a blank byline.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ReviewListProps {
  productId: string;
  initialItems: ProductReview[];
  initialCursor: string | null;
  /** Kept in step with the server's first-page size. */
  pageSize?: number;
  className?: string;
}

function reviewerName(review: ProductReview): string {
  const name = review.customer.name?.trim();
  return name && name.length > 0 ? name : 'Verified buyer';
}

/** `next/image` throws on a host `next.config.ts` does not declare. */
function isOptimisable(url: string): boolean {
  return url.startsWith('https://');
}

function ReviewCard({ review }: { review: ProductReview }) {
  return (
    <li className="space-y-2 border-b border-line py-5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} size="sm" />
        <span className="sr-only">{review.rating} out of 5</span>
        <span className="text-sm font-medium text-ink-strong">{reviewerName(review)}</span>
        <span className="text-xs text-ink-faint">{formatDate(review.created_at)}</span>
      </div>

      {review.title ? (
        <p className="text-sm font-medium text-ink-strong">{review.title}</p>
      ) : null}
      {review.body ? (
        <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line text-ink-subtle">
          {review.body}
        </p>
      ) : null}

      {review.media.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pt-1">
          {review.media.filter(isOptimisable).map((url) => (
            <li key={url} className="relative size-16 overflow-hidden rounded-lg border border-line">
              <Image
                src={url}
                alt={`Photo from ${reviewerName(review)}'s review`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ReviewList({
  productId,
  initialItems,
  initialCursor,
  pageSize = 10,
  className,
}: ReviewListProps) {
  const [items, setItems] = useState<ProductReview[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/catalog/products/${productId}/reviews?limit=${pageSize}&cursor=${encodeURIComponent(cursor)}`,
        { credentials: 'omit' },
      );
      if (!response.ok) throw new Error(`Reviews answered ${response.status}`);
      const page = (await response.json()) as ProductReviewPage;

      // A duplicate id would mean the cursor was replayed; de-duplicating keeps
      // React keys unique rather than throwing in the middle of a list.
      setItems((current) => {
        const seen = new Set(current.map((r) => r.id));
        return [...current, ...page.items.filter((r) => !seen.has(r.id))];
      });
      setCursor(page.next_cursor);
    } catch {
      setError('We could not load more reviews just now.');
    } finally {
      setIsLoading(false);
    }
  }, [cursor, isLoading, pageSize, productId]);

  if (items.length === 0) return null;

  return (
    <div data-slot="review-list" className={cn('space-y-4', className)}>
      <ul>
        {items.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </ul>

      {error ? <p className="text-sm text-ink-muted">{error}</p> : null}

      {cursor ? (
        <Button variant="outline" size="lg" onClick={() => void loadMore()} disabled={isLoading}>
          {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {isLoading ? 'Loading…' : 'Show more reviews'}
        </Button>
      ) : null}
    </div>
  );
}
