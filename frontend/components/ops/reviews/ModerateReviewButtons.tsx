'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import type { ModerationReview, ReviewStatus } from '@/lib/types/reviews';

/**
 * `PATCH /reviews/:id/publish` and `/hide` (`REV-02`, `MANAGE_OPS`).
 *
 * **Deliberately not optimistic** (P5b decision 24). Moderating a review
 * recomputes `Product.rating_avg` / `rating_count`, and that rollup runs in
 * *two* places — inside `ReviewsService.moderate`'s transaction and again in a
 * database trigger — which compute identical values by construction. The client
 * has no business guessing what the new average will be, so the button shows a
 * pending state, the server's row is what lands in the cache, and the product
 * queries are invalidated so any open catalog screen refetches the real figure.
 *
 * The note is optional and lands on the `AuditEvent`, not on a `Review` column,
 * which is why it is asked for on **hide** (an action that needs a reason on the
 * record) and not on publish (the benign default, kept to one click so a queue
 * of pending reviews can actually be worked through).
 */
interface ModerateReviewButtonsProps {
  review: ModerationReview;
}

/**
 * What `moderate` actually answers with: `ReviewsService.moderate` returns the
 * bare updated `Review` row — **not** the `product`/`customer` joins the list
 * read carries — so the response is typed to what is really there rather than
 * to `ModerationReview`.
 */
type ModeratedReview = Pick<ModerationReview, 'id' | 'status' | 'rating'>;

export function ModerateReviewButtons({ review }: ModerateReviewButtonsProps) {
  const queryClient = useQueryClient();
  const [hideOpen, setHideOpen] = useState(false);
  const [note, setNote] = useState('');

  const moderate = useMutation({
    mutationFn: ({ status, note }: { status: ReviewStatus; note?: string }) =>
      apiClient.patch<ModeratedReview>(
        `/reviews/${review.id}/${status === 'published' ? 'publish' : 'hide'}`,
        note ? { note } : {},
      ),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      // The rating rollup lives on the product, not on the review — refetch it
      // rather than predicting the new average.
      void queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
      toast.success(
        updated.status === 'published'
          ? `Published to ${review.product.name}.`
          : `Hidden from ${review.product.name}.`,
        {
          description:
            updated.status === 'published'
              ? `Its ${updated.rating}-star score now counts towards the product's rating.`
              : 'Its score no longer counts towards the product’s rating.',
        },
      );
      setHideOpen(false);
      setNote('');
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, 'The review could not be moderated.'));
    },
  });

  const pending = moderate.isPending;
  const canPublish = review.status !== 'published';
  const canHide = review.status !== 'hidden';

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {canPublish && (
          <Button
            size="sm"
            onClick={() => moderate.mutate({ status: 'published' })}
            disabled={pending}
          >
            {pending && moderate.variables?.status === 'published' ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Check className="size-4" />
            )}
            Publish
          </Button>
        )}
        {canHide && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setHideOpen(true)}
            disabled={pending}
          >
            <EyeOff className="size-4" />
            Hide
          </Button>
        )}
      </div>

      <Dialog
        open={hideOpen}
        onOpenChange={(open) => {
          if (!pending) setHideOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide this review?</DialogTitle>
            <DialogDescription>
              It leaves {review.product.name}&apos;s page and its {review.rating}
              -star score stops counting towards the product rating. The customer
              still sees it on their own account as un-published. You can publish
              it again at any time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`hide-note-${review.id}`}>Reason (optional)</Label>
            <Textarea
              id={`hide-note-${review.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. names a member of staff, or is about the wrong product."
              disabled={pending}
              style={{ minHeight: '72px' }}
            />
            <p className="text-xs text-ink-faint">
              Recorded on the audit trail against your name. It is never shown to
              the customer.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHideOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                moderate.mutate({ status: 'hidden', note: note.trim() || undefined })
              }
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Hiding…
                </>
              ) : (
                'Hide review'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
