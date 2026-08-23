'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Minus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError, apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode, ROLE_DISPLAY_NAMES } from '@/lib/types/roles';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { Decision, DecisionVote, VoteValue } from '@/lib/types/decisions';
import {
  OPEN_DECISION_STATUSES,
  VOTE_VALUE_LABELS,
} from '@/lib/types/decisions';

/** `role_code` is a plain string column — unknown codes print as-is. */
function roleLabel(code: string): string {
  return ROLE_DISPLAY_NAMES[code as RoleCode] ?? code;
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

const VOTE_BADGE: Record<VoteValue, string> = {
  approve: STATUS_BADGE.good,
  reject: STATUS_BADGE.serious,
  abstain: STATUS_BADGE.neutral,
};

const VOTE_ICON = {
  approve: Check,
  reject: X,
  abstain: Minus,
} as const;

interface DecisionVotePanelProps {
  decision: Decision;
  /** Called after any successful vote / resolve / reopen. */
  onChanged: () => void;
}

interface VoteRow {
  roleCode: string;
  vote: DecisionVote | null;
}

export function DecisionVotePanel({
  decision,
  onChanged,
}: DecisionVotePanelProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isFounder = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const [pendingVote, setPendingVote] = useState<VoteValue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveStatus, setResolveStatus] = useState<'approved' | 'rejected'>(
    'approved',
  );
  const [finalDecision, setFinalDecision] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);

  const votes = useMemo(() => decision.votes ?? [], [decision.votes]);

  /** One row per required role; a role with no vote yet is "waiting". */
  const rows = useMemo<VoteRow[]>(
    () =>
      decision.required_role_codes.map((roleCode) => ({
        roleCode,
        vote: votes.find((v) => v.role_code === roleCode) ?? null,
      })),
    [decision.required_role_codes, votes],
  );

  /** Votes cast by someone whose role is not on the decision (e.g. the founder). */
  const extraVotes = useMemo(
    () => votes.filter((v) => !decision.required_role_codes.includes(v.role_code)),
    [decision.required_role_codes, votes],
  );

  const approvedCount = rows.filter((r) => r.vote?.vote === 'approve').length;
  const isOpen = OPEN_DECISION_STATUSES.includes(decision.status);
  const isOnDecision =
    !!user && decision.required_role_codes.includes(user.roleCode);
  const canVote = isOpen && (isFounder || isOnDecision);
  const myVote = votes.find((v) => v.user_id === user?.id) ?? null;

  const castVote = async (vote: VoteValue, notes?: string) => {
    setPendingVote(vote);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/decisions/${decision.id}/votes`, {
        vote,
        ...(notes ? { notes } : {}),
      });
      toast.success(`Vote recorded: ${VOTE_VALUE_LABELS[vote].toLowerCase()}.`);
      void queryClient.invalidateQueries({ queryKey: ['decisions'] });
      onChanged();
    } catch (error) {
      toast.error(failureMessage(error, "Couldn't record that vote."));
    } finally {
      setIsSubmitting(false);
      setPendingVote(null);
    }
  };

  /** SPEC §6.4 — a reject always carries a note, the same rule as approvals. */
  const handleReject = async () => {
    const notes = rejectNotes.trim();
    if (!notes) return;
    await castVote('reject', notes);
    setRejectNotes('');
    setRejectOpen(false);
  };

  const handleResolve = async () => {
    const final = finalDecision.trim();
    if (final.length < 3) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/decisions/${decision.id}/resolve`, {
        status: resolveStatus,
        final_decision: final,
      });
      toast.success('Decision resolved.');
      void queryClient.invalidateQueries({ queryKey: ['decisions'] });
      setResolveOpen(false);
      setFinalDecision('');
      onChanged();
    } catch (error) {
      toast.error(failureMessage(error, "Couldn't resolve this decision."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    setIsSubmitting(true);
    try {
      await apiClient.post(`/decisions/${decision.id}/reopen`);
      toast.success('Decision reopened. Existing votes were cleared.');
      void queryClient.invalidateQueries({ queryKey: ['decisions'] });
      setReopenOpen(false);
      onChanged();
    } catch (error) {
      toast.error(failureMessage(error, "Couldn't reopen this decision."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderVoteBadge = (vote: DecisionVote) => {
    const Icon = VOTE_ICON[vote.vote];
    return (
      <Badge variant="outline" className={`gap-1 ${VOTE_BADGE[vote.vote]}`}>
        <Icon aria-hidden="true" />
        {VOTE_VALUE_LABELS[vote.vote]}
      </Badge>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface-raised/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Sign-off
        </p>
        <p className="text-sm text-ink-subtle" aria-live="polite">
          {rows.length > 0
            ? `${approvedCount} of ${rows.length} approved`
            : 'No required roles on this decision'}
        </p>
      </div>

      {/* One row per required role */}
      {rows.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {rows.map((row) => (
            <li
              key={row.roleCode}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
            >
              <span className="text-sm font-medium text-ink">
                {roleLabel(row.roleCode)}
              </span>
              {row.vote ? (
                <>
                  {renderVoteBadge(row.vote)}
                  <span className="text-xs text-ink-muted">
                    {row.vote.user?.name ?? 'Unknown'}
                  </span>
                  {row.vote.notes && (
                    <span className="w-full text-xs italic text-ink-muted sm:w-auto sm:flex-1">
                      &ldquo;{row.vote.notes}&rdquo;
                    </span>
                  )}
                </>
              ) : (
                <Badge variant="outline" className={STATUS_BADGE.warning}>
                  Waiting
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Votes from people not on the required list (the founder, typically) */}
      {extraVotes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Other votes
          </p>
          <ul className="space-y-1">
            {extraVotes.map((vote) => (
              <li key={vote.id} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-subtle">
                  {vote.user?.name ?? 'Unknown'} ({roleLabel(vote.role_code)})
                </span>
                {renderVoteBadge(vote)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {canVote ? (
          <>
            <Button
              size="sm"
              onClick={() => void castVote('approve')}
              disabled={isSubmitting}
            >
              {isSubmitting && pendingVote === 'approve' ? (
                <>
                  <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                  Voting...
                </>
              ) : (
                'Approve'
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setRejectOpen(true)}
              disabled={isSubmitting}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void castVote('abstain')}
              disabled={isSubmitting}
            >
              {isSubmitting && pendingVote === 'abstain' ? (
                <>
                  <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                  Voting...
                </>
              ) : (
                'Abstain'
              )}
            </Button>
            {myVote && (
              <span className="text-xs text-ink-muted">
                You voted {VOTE_VALUE_LABELS[myVote.vote].toLowerCase()} — voting
                again replaces it.
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-ink-muted">
            {isOpen
              ? 'Your role is not on this decision.'
              : `This decision is ${decision.status} and no longer accepts votes.`}
          </span>
        )}

        {isFounder && (
          <div className="ml-auto flex items-center gap-2">
            {isOpen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResolveOpen(true)}
                disabled={isSubmitting}
              >
                Resolve
              </Button>
            )}
            {!isOpen && (
              <Button
                size="sm"
                variant="outline"
                className="border-warning/40 text-warning"
                onClick={() => setReopenOpen(true)}
                disabled={isSubmitting}
              >
                Reopen
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Reject — the note is required */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this decision?</DialogTitle>
            <DialogDescription>
              A reject ends the decision for everyone. Say why so the proposer
              can act on it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decision-reject-notes">Reason</Label>
            <Textarea
              id="decision-reject-notes"
              placeholder="What makes this the wrong call right now?"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              disabled={isSubmitting}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejectOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={!rejectNotes.trim() || isSubmitting}
            >
              {isSubmitting ? 'Rejecting...' : 'Reject decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Founder resolve — tier 3, and the escape hatch for a stalled tier 2 */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve this decision</DialogTitle>
            <DialogDescription>
              The founder&apos;s call. It closes the decision regardless of the
              current tally and is recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="decision-resolve-status">Outcome</Label>
              <Select
                value={resolveStatus}
                onValueChange={(value) =>
                  setResolveStatus(value as 'approved' | 'rejected')
                }
              >
                <SelectTrigger id="decision-resolve-status" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === 'rejected' ? 'Rejected' : 'Approved'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="decision-final">Final decision</Label>
              <Textarea
                id="decision-final"
                placeholder="What was decided, and on what grounds?"
                value={finalDecision}
                onChange={(e) => setFinalDecision(e.target.value)}
                disabled={isSubmitting}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setResolveOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleResolve()}
              disabled={finalDecision.trim().length < 3 || isSubmitting}
            >
              {isSubmitting ? 'Resolving...' : 'Resolve decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Founder reopen — clears every vote */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen this decision?</DialogTitle>
            <DialogDescription>
              Every vote already cast is cleared and the tally restarts from
              zero. The resolution is removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setReopenOpen(false)}
              disabled={isSubmitting}
            >
              Keep locked
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleReopen()}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Reopening...' : 'Reopen and clear votes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
