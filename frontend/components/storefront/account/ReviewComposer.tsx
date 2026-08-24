'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { StarRatingInput } from '@/components/public/StarRatingInput';
import { accountKeys } from '@/components/storefront/account/account-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, apiErrorMessage, apiErrorStatus } from '@/lib/api-client';
import type { CreateReviewPayload, PendingReview } from '@/lib/types/reviews';

/**
 * Write one review (`REV-01`).
 *
 * **Keyed on `order_item_id`, never on a product.** `Review.order_item_id` is
 * unique in the database, so "one review per delivered line" is enforced there
 * and this form only has to render what the server says when it is not met.
 *
 * The three failures are three different sentences and all of them come from the
 * server verbatim (P5b decision 4):
 *
 * | status | what happened | what the customer should do |
 * |---|---|---|
 * | `409` | already reviewed | nothing — the review is in the Written list |
 * | `400` | the line is not delivered or attended yet | wait |
 * | `403` | someone else's line | nothing; this should be unreachable from here |
 *
 * A `409` also refetches both lists, because the pending list that produced this
 * form is evidently stale.
 */
export interface ReviewComposerProps {
  pending: PendingReview;
  onDone: () => void;
}

export function ReviewComposer({ pending, onDone }: ReviewComposerProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const submit = useMutation({
    mutationFn: (payload: CreateReviewPayload) =>
      apiClient.post('/customer/reviews', payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountKeys.reviews() }),
        queryClient.invalidateQueries({ queryKey: accountKeys.pendingReviews() }),
      ]);
      toast.success('Thank you — your review is in', {
        description:
          'It appears on the product page once a moderator has read it.',
      });
      onDone();
    },
    onError: async (error) => {
      const status = apiErrorStatus(error);
      toast.error(apiErrorMessage(error, 'Your review did not go through'));
      if (status === 409) {
        await queryClient.invalidateQueries({
          queryKey: accountKeys.pendingReviews(),
        });
        onDone();
      }
    },
  });

  return (
    <form
      className="space-y-4 rounded-xl border border-line bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (rating < 1) return;
        const payload: CreateReviewPayload = {
          order_item_id: pending.order_item_id,
          rating,
        };
        if (title.trim()) payload.title = title.trim();
        if (body.trim()) payload.body = body.trim();
        submit.mutate(payload);
      }}
    >
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink-strong">
          {pending.product.name}
        </h3>
        <p className="text-xs text-ink-muted">
          From order #{pending.order.order_number}
        </p>
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-ink-strong">
          Your rating
        </span>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`review-title-${pending.order_item_id}`}>
          Headline <span className="text-ink-faint">(optional)</span>
        </Label>
        <Input
          id={`review-title-${pending.order_item_id}`}
          maxLength={120}
          placeholder="Sum it up in a few words"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`review-body-${pending.order_item_id}`}>
          Review <span className="text-ink-faint">(optional)</span>
        </Label>
        <Textarea
          id={`review-body-${pending.order_item_id}`}
          rows={4}
          maxLength={2000}
          placeholder="What was it like? What would you tell a friend?"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={rating < 1 || submit.isPending}>
          {submit.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Post review
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {rating < 1 ? (
          <span className="text-xs text-ink-faint">A rating is required.</span>
        ) : null}
      </div>
    </form>
  );
}
