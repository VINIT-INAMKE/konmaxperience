'use client';

/**
 * SPEC §6.4 — approve or reject **from the row**. Opening a detail page to
 * click one button is the single most common piece of friction in the inbox, so
 * the decision happens where the row is and the row leaves the list the instant
 * it is decided.
 *
 * Approve fires immediately. Reject expands an inline note field, because a
 * rejection with no reason is a dead end for whoever has to redo the work — the
 * backend enforces the same rule (`normaliseDecision` 400s on an empty note),
 * this just stops the request from being sent at all.
 *
 * Transport: `POST /approvals/:id/decide { decision, note? }`. If that route is
 * ever absent (a 404 — the contract predates P3 landing) the component falls
 * back to the older `POST /approvals/:id/approve` and `/reject { notes }`.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiClient } from '@/lib/api-client';
import { P31 } from '@/lib/api/phase31';
import { HEADER_CONTEXT_QUERY_KEY } from '@/lib/hooks/use-header-context';
import { reportError } from '@/lib/report-error';
import { trackAction } from '@/lib/usage';
import { USAGE_ACTIONS } from '@/lib/types/usage';
import type { Approval } from '@/lib/types/approvals';

/** SPEC §6.4 — a rejection has to say why, and ten characters is the floor. */
const rejectNoteSchema = z
  .string()
  .trim()
  .min(10, 'Say why in at least 10 characters');

/** Every cached list of pending approvals — the rows the decision removes. */
const PENDING_LIST_KEY = ['approvals', 'pending'] as const;

type ApprovalList = Approval[] | { items: Approval[] } | undefined;

/** Drops the decided row from either list shape, leaving anything else alone. */
function withoutApproval(list: ApprovalList, id: string): ApprovalList {
  if (Array.isArray(list)) return list.filter((row) => row.id !== id);
  if (list && Array.isArray(list.items)) {
    return { ...list, items: list.items.filter((row) => row.id !== id) };
  }
  return list;
}

interface InlineDecisionProps {
  approvalId: string;
  /** Lower-case noun for the labels — "evidence", "task", "recipe". */
  subjectLabel?: string;
  /** Extra caches the decision invalidates (the task or recipe it belongs to). */
  extraInvalidateKeys?: readonly (readonly unknown[])[];
  /** Fired after a successful decision, for callers that own their own refetch. */
  onDecided?: (decision: 'approve' | 'reject') => void;
  size?: 'xs' | 'sm';
  disabled?: boolean;
}

export function InlineDecision({
  approvalId,
  subjectLabel = 'this',
  extraInvalidateKeys,
  onDecided,
  size = 'sm',
  disabled = false,
}: InlineDecisionProps) {
  const queryClient = useQueryClient();

  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);

  const noteResult = rejectNoteSchema.safeParse(note);
  const noteError = noteResult.success ? null : noteResult.error.issues[0].message;
  const busy = pending !== null || disabled;

  async function send(decision: 'approve' | 'reject', text?: string) {
    try {
      await apiClient.post(P31.decideApproval(approvalId), {
        decision,
        ...(text ? { note: text } : {}),
      });
    } catch (error) {
      // Pre-P3 backends only have the two verb routes.
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      if (decision === 'approve') {
        await apiClient.post(`/approvals/${approvalId}/approve`);
      } else {
        await apiClient.post(`/approvals/${approvalId}/reject`, {
          notes: text,
        });
      }
    }
  }

  async function decide(decision: 'approve' | 'reject', text?: string) {
    setPending(decision);

    // Optimistic: the row disappears now, and comes back if the call fails.
    await queryClient.cancelQueries({ queryKey: PENDING_LIST_KEY });
    const snapshot = queryClient.getQueriesData<ApprovalList>({
      queryKey: PENDING_LIST_KEY,
    });
    queryClient.setQueriesData<ApprovalList>(
      { queryKey: PENDING_LIST_KEY },
      (old) => withoutApproval(old, approvalId),
    );

    try {
      await send(decision, text);
      trackAction(USAGE_ACTIONS.APPROVAL_DECIDE, { decision });
      toast.success(decision === 'approve' ? 'Approved.' : 'Feedback sent.');
      setRejecting(false);
      setNote('');
      setTouched(false);
      onDecided?.(decision);
    } catch (error) {
      for (const [key, data] of snapshot) {
        queryClient.setQueryData(key, data);
      }
      reportError(error, { where: 'InlineDecision.decide', decision });
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : decision === 'approve'
            ? "Couldn't approve that — try again."
            : "Couldn't send that feedback — try again.",
      );
    } finally {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({
        queryKey: HEADER_CONTEXT_QUERY_KEY,
      });
      void queryClient.invalidateQueries({ queryKey: ['evidence'] });
      for (const key of extraInvalidateKeys ?? []) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }
  }

  const noteFieldId = `reject-note-${approvalId}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size={size}
          onClick={() => void decide('approve')}
          disabled={busy || rejecting}
        >
          {pending === 'approve' ? (
            <>
              <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
              Approving...
            </>
          ) : (
            <>
              <Check className="size-3.5" aria-hidden="true" />
              Approve
            </>
          )}
        </Button>

        {!rejecting && (
          <Button
            size={size}
            variant="destructive"
            onClick={() => setRejecting(true)}
            disabled={busy}
          >
            <X className="size-3.5" aria-hidden="true" />
            Reject
          </Button>
        )}
      </div>

      {rejecting && (
        <div className="space-y-2 rounded-lg border border-line bg-surface-raised p-3">
          <Label htmlFor={noteFieldId} className="text-xs">
            Why is {subjectLabel} being sent back?
          </Label>
          <Textarea
            id={noteFieldId}
            rows={3}
            autoFocus
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && !!noteError}
            aria-describedby={`${noteFieldId}-hint`}
            placeholder="e.g. The photo doesn't show the finished setup — retake it with the plated dish in frame."
            disabled={pending !== null}
          />
          <p
            id={`${noteFieldId}-hint`}
            className={
              touched && noteError
                ? 'text-xs text-[var(--status-serious)]'
                : 'text-xs text-ink-muted'
            }
          >
            {touched && noteError
              ? noteError
              : 'They only see this note — make it enough to act on.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size={size}
              variant="destructive"
              onClick={() => void decide('reject', note.trim())}
              disabled={!noteResult.success || pending !== null}
            >
              {pending === 'reject' ? (
                <>
                  <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                  Sending...
                </>
              ) : (
                'Send feedback'
              )}
            </Button>
            <Button
              size={size}
              variant="ghost"
              onClick={() => {
                setRejecting(false);
                setNote('');
                setTouched(false);
              }}
              disabled={pending !== null}
            >
              Keep pending
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
