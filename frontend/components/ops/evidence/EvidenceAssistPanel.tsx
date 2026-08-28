'use client';

import { useState } from 'react';
import {
  ChevronDown,
  Loader2,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import { optionalGet } from '@/lib/api/optional';
import { STATUS_BADGE } from '@/lib/status-styles';
import { cn } from '@/lib/utils';
import {
  ASSIST_VERDICT_LABELS,
  assistProvenance,
  confidencePercent,
  type EvidenceAssistVerdict,
  type EvidenceReviewSuggestion,
} from '@/lib/types/ai';

/**
 * The verdict chip's colours.
 *
 * `good` and `serious` are pointedly **not** used: those are the two colours the
 * evidence status badge wears once a human has actually approved or rejected the
 * item. Borrowing them here would let a glance down the page read a suggestion
 * as a decision that has already been taken, which is the exact failure SPEC
 * §1.2 exists to prevent. A suggestion is information, so it reads as
 * information.
 */
const VERDICT_BADGE: Record<EvidenceAssistVerdict, string> = {
  approve: STATUS_BADGE.info,
  reject: STATUS_BADGE.warning,
  unsure: STATUS_BADGE.neutral,
};

interface EvidenceAssistPanelProps {
  evidenceId: string;
}

/**
 * SPEC §1.2 / RUN-05 — a second opinion on a piece of evidence, printed *below*
 * the approve and reject buttons a person uses.
 *
 * Three properties this component must keep, all of them load-bearing:
 *
 * 1. **It never generates on render.** `POST` costs a model call, so it happens
 *    only when a reviewer presses the button. Opening the panel does a `GET`,
 *    which never generates and answers `null` when nothing is stored.
 * 2. **It never touches the decision controls.** They live in `EvidenceItem`,
 *    above this panel, and this component has no handle on them: no callback,
 *    no shared state, nothing to pre-select or disable with. That is deliberate
 *    — the guarantee is structural rather than a rule someone has to remember.
 * 3. **Every failure is inline.** A dead assist endpoint, a throttle, a
 *    disabled provider — none of it may stand between a reviewer and the
 *    approve button, so nothing here throws to an error boundary or opens a
 *    modal.
 */
export function EvidenceAssistPanel({ evidenceId }: EvidenceAssistPanelProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = ['evidence', evidenceId, 'review-assist'];

  const {
    data: suggestion,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    // `optionalGet` covers the reviewer whose role the client guessed wrong:
    // a 403 becomes "nothing to show" instead of a red block on the row.
    queryFn: () =>
      optionalGet<EvidenceReviewSuggestion>(
        `/evidence/${evidenceId}/review-assist`,
      ),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const ask = useMutation({
    mutationFn: () =>
      apiClient.post<EvidenceReviewSuggestion>(
        `/evidence/${evidenceId}/review-assist`,
        {},
      ),
    onSuccess: (row) => {
      queryClient.setQueryData(queryKey, row);
    },
  });

  const percent = suggestion ? confidencePercent(suggestion.confidence) : null;
  const panelId = `evidence-assist-${evidenceId}`;

  return (
    <div className="pl-9">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-center gap-1.5 rounded-sm text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] motion-reduce:transition-none"
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        Review assist
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="mt-2 space-y-3 rounded-lg border border-[var(--line)] bg-surface-raised p-3"
        >
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-1.5 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-ink-muted">
                Could not load the suggestion. Approving and rejecting still
                work.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            </div>
          ) : !suggestion ? (
            <div className="space-y-2">
              <p className="text-xs text-ink-muted">
                No suggestion has been asked for on this item. It is advice, not
                a decision — you can approve or reject without it.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => ask.mutate()}
                disabled={ask.isPending}
              >
                {ask.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Ask for a suggestion
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                    VERDICT_BADGE[suggestion.verdict],
                  )}
                >
                  {ASSIST_VERDICT_LABELS[suggestion.verdict]}
                </span>
                {percent !== null && (
                  <span className="text-xs tabular-nums text-ink-muted">
                    {percent}% confident
                  </span>
                )}
              </div>

              {percent !== null && (
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Suggestion confidence"
                >
                  <div
                    className="h-full rounded-full bg-[var(--status-info)]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}

              {suggestion.reasons.length > 0 && (
                <ul className="space-y-1">
                  {suggestion.reasons.map((reason, index) => (
                    <li
                      key={`${suggestion.id}-${index}`}
                      className="flex gap-2 text-xs text-ink"
                    >
                      <span aria-hidden="true" className="text-ink-muted">
                        •
                      </span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] italic text-ink-muted">
                  {assistProvenance(suggestion.provider, suggestion.model)}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => ask.mutate()}
                  disabled={ask.isPending}
                >
                  {ask.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                      Thinking...
                    </>
                  ) : (
                    'Ask again'
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Inline and non-blocking: "assist is disabled", a throttle, a
              provider outage. None of it changes what the reviewer can do. */}
          {ask.isError && (
            <p className="flex items-start gap-1.5 text-xs text-[var(--status-warning)]">
              <TriangleAlert
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                {apiErrorMessage(
                  ask.error,
                  'The suggestion could not be generated.',
                )}{' '}
                You can still approve or reject this evidence.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
