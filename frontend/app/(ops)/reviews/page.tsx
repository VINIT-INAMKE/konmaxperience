'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReviewFilterBar } from '@/components/ops/reviews/ReviewFilterBar';
import { ReviewModerationTable } from '@/components/ops/reviews/ReviewModerationTable';
import { apiClient } from '@/lib/api-client';
import type { ReviewsEnvelope, ReviewStatusFilter } from '@/lib/types/reviews';

const PAGE_SIZE = 25;

function reviewsPath(status: ReviewStatusFilter, cursor: string | null): string {
  const params = new URLSearchParams({
    status,
    limit: String(PAGE_SIZE),
  });
  if (cursor) params.set('cursor', cursor);
  return `/reviews?${params.toString()}`;
}

/**
 * `OPS-02` / `REV-02` — the staff moderation queue (`MANAGE_OPS`).
 *
 * Defaults to `pending`, which is also what `GET /reviews` does with no
 * `?status=`; the parameter is still sent explicitly so the URL a developer sees
 * in the network tab says what the screen is showing.
 *
 * Publishing or hiding recomputes `Product.rating_avg` and `rating_count`. That
 * rollup runs both inside `ReviewsService.moderate`'s transaction and in a
 * database trigger, and the two compute identical values — so no screen here
 * ever predicts the new average. `ModerateReviewButtons` invalidates the product
 * queries and lets the server answer.
 */
export default function ReviewsPage() {
  const [filter, setFilter] = useState<ReviewStatusFilter>('pending');

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['reviews', 'moderation', filter],
    queryFn: ({ pageParam }) =>
      apiClient.get<ReviewsEnvelope>(reviewsPath(filter, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: ReviewsEnvelope) => lastPage.next_cursor,
  });

  const reviews = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-ink">Reviews</h1>
        <p className="text-sm text-ink-muted">
          Customers can review a line once it has been delivered or attended.
          Publishing one puts it on the product page and folds its score into the
          product&apos;s rating.
        </p>
      </div>

      <ReviewFilterBar value={filter} onChange={setFilter} />

      <ReviewModerationTable
        reviews={reviews}
        isLoading={isLoading}
        isError={isError}
        filter={filter}
        onRetry={() => void refetch()}
      />

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
