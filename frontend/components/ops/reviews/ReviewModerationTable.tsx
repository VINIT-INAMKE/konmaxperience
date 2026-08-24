'use client';

import { AlertTriangle, CheckCircle2, EyeOff, MessagesSquare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ModerationReview, ReviewStatusFilter } from '@/lib/types/reviews';
import { ReviewCard } from './ReviewCard';

const SKELETON_ROWS = ['a', 'b', 'c'];

/**
 * The empty state is written per filter, and the `pending` one is deliberately a
 * *positive* result rather than a shrug — an empty moderation queue means the
 * work is done, which is worth saying plainly.
 */
const EMPTY_STATES: Record<
  ReviewStatusFilter,
  { icon: typeof CheckCircle2; title: string; body: string }
> = {
  pending: {
    icon: CheckCircle2,
    title: 'Nothing waiting on you',
    body: 'Every review a customer has written has been published or hidden. New ones land here the moment they are submitted.',
  },
  published: {
    icon: MessagesSquare,
    title: 'No published reviews yet',
    body: 'Reviews you publish appear on the product page and count towards its rating. Start with the Pending tab.',
  },
  hidden: {
    icon: EyeOff,
    title: 'Nothing hidden',
    body: 'Reviews you hide are kept here so the decision can be revisited. None so far.',
  },
  all: {
    icon: MessagesSquare,
    title: 'No reviews yet',
    body: 'A customer can review a line once it has been delivered or attended, so the first ones arrive after the first orders land.',
  },
};

interface ReviewModerationTableProps {
  reviews: ModerationReview[];
  isLoading: boolean;
  isError: boolean;
  /** Decides which empty copy is shown. */
  filter: ReviewStatusFilter;
  onRetry: () => void;
}

export function ReviewModerationTable({
  reviews,
  isLoading,
  isError,
  filter,
  onRetry,
}: ReviewModerationTableProps) {
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Could not load reviews</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          The moderation queue did not come back. Nothing has been published or
          hidden.
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {SKELETON_ROWS.map((row) => (
          <Card key={row} size="sm">
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-44" />
              </div>
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    const empty = EMPTY_STATES[filter];
    const Icon = empty.icon;
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line py-16 text-center">
        <Icon
          className={filter === 'pending' ? 'size-10 text-good' : 'size-10 text-ink-faint'}
          aria-hidden
        />
        <div className="space-y-1">
          <h2 className="text-base font-medium text-ink">{empty.title}</h2>
          <p className="mx-auto max-w-[52ch] text-sm text-ink-muted">
            {empty.body}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review) => (
        <li key={review.id}>
          <ReviewCard review={review} />
        </li>
      ))}
    </ul>
  );
}
