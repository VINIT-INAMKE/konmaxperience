'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
import { RejectionDialog } from '@/components/ops/evidence/RejectionDialog';
import { ApiError, apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode, ROLE_DISPLAY_NAMES } from '@/lib/types/roles';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { ApprovalGateRow, ApprovalStatus } from '@/lib/types/approvals';
import type { RecipeStatus } from '@/lib/types/recipe';
import { RECIPE_STATUS_LABELS } from '@/lib/types/recipe';

const GATE_BADGE: Record<ApprovalStatus, string> = {
  pending: STATUS_BADGE.warning,
  approved: STATUS_BADGE.good,
  rejected: STATUS_BADGE.serious,
};

/** `required_role_code` is a plain string column — unknown codes print as-is. */
function roleLabel(code: string): string {
  return ROLE_DISPLAY_NAMES[code as RoleCode] ?? code;
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

interface RecipeStatusBannerProps {
  status: RecipeStatus;
  isApprover: boolean;
  isSaving: boolean;
  onStatusChange: (newStatus: RecipeStatus) => void;
  onCreateVersion: () => void;
  /** Falls back to the `[id]` route segment the recipe builder lives on. */
  recipeId?: string;
}

export function RecipeStatusBanner({
  status,
  isApprover,
  isSaving,
  onStatusChange,
  onCreateVersion,
  recipeId: recipeIdProp,
}: RecipeStatusBannerProps) {
  const params = useParams<{ id?: string }>();
  const recipeId = recipeIdProp ?? params?.id;

  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isFounder = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  /**
   * SPEC §4.4 — `pending → approved` by PATCH now 400s. The gate is the set of
   * policy-generated `Approval` rows for this recipe; the flip happens inside
   * `ApprovalsService` when the last required approval lands.
   */
  const { data: gate } = useQuery({
    queryKey: ['recipe-approvals', recipeId],
    queryFn: () =>
      apiClient.get<ApprovalGateRow[]>(`/recipes/${recipeId}/approvals`),
    enabled: !!recipeId && status === 'pending',
  });

  const invalidateRecipe = () => {
    void queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
    void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    void queryClient.invalidateQueries({
      queryKey: ['recipe-approvals', recipeId],
    });
    void queryClient.invalidateQueries({ queryKey: ['approvals'] });
  };

  /** `draft → pending`, which materialises the `(recipe, food)` gate. */
  const submitMutation = useMutation({
    mutationFn: () => apiClient.post(`/recipes/${recipeId}/submit`),
    onSuccess: () => {
      // The builder re-reads `status` from the refetched recipe, so the
      // invalidation is what moves the banner to `pending`.
      toast.success('Submitted for approval.');
      invalidateRecipe();
    },
    onError: (error: unknown) => {
      toast.error(failureMessage(error, 'Failed to submit for approval.'));
    },
  });

  const decideMutation = useMutation({
    mutationFn: ({
      approvalId,
      decision,
      notes,
    }: {
      approvalId: string;
      decision: 'approve' | 'reject';
      notes?: string;
    }) =>
      apiClient.post(
        `/approvals/${approvalId}/${decision}`,
        decision === 'reject' ? { notes } : undefined,
      ),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === 'approve'
          ? 'Approval recorded.'
          : 'Recipe rejected.',
      );
      setRejectDialogOpen(false);
      setRejectingId(null);
      invalidateRecipe();
    },
    onError: (error: unknown) => {
      toast.error(failureMessage(error, 'Failed to record that decision.'));
    },
  });

  const busy = isSaving || submitMutation.isPending || decideMutation.isPending;

  const bannerClasses: Record<RecipeStatus, string> = {
    draft: 'bg-surface-raised text-ink-subtle',
    pending: 'bg-warning/12 text-warning',
    approved: 'bg-good/12 text-good',
    archived: 'bg-surface-raised/60 text-ink-muted',
  };

  const approvedCount = (gate ?? []).filter(
    (row) => row.status === 'approved',
  ).length;

  /** A row this viewer can act on: their own required role, or the founder. */
  const canDecide = (row: ApprovalGateRow) =>
    row.status === 'pending' &&
    (isFounder || row.required_role_code === user?.roleCode);

  const handleSubmit = () => {
    if (recipeId) {
      submitMutation.mutate();
    } else {
      // No route id to submit against — fall back to the parent's PATCH, which
      // still performs `draft → pending`.
      onStatusChange('pending');
    }
  };

  return (
    <>
      <div className="space-y-2">
        <div
          className={cn(
            'flex flex-col justify-between gap-2 rounded-lg px-3 py-2 sm:h-12 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-0',
            bannerClasses[status],
          )}
        >
          <span className="text-sm font-medium">
            {status === 'approved' && 'Approved — locked for editing'}
            {status === 'archived' && (
              <span className="line-through">
                {RECIPE_STATUS_LABELS[status]}
              </span>
            )}
            {status === 'draft' && RECIPE_STATUS_LABELS[status]}
            {status === 'pending' &&
              (gate && gate.length > 0
                ? `Awaiting approval — ${approvedCount} of ${gate.length} signed off`
                : RECIPE_STATUS_LABELS[status])}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {status === 'draft' && (
              <Button size="sm" onClick={handleSubmit} disabled={busy}>
                {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            )}

            {status === 'pending' && isApprover && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWithdrawDialogOpen(true)}
                disabled={busy}
              >
                Send Back to Draft
              </Button>
            )}

            {status === 'approved' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setVersionDialogOpen(true)}
                  disabled={busy}
                >
                  Create New Version
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setArchiveDialogOpen(true)}
                  disabled={busy}
                >
                  Archive Recipe
                </Button>
              </>
            )}
          </div>
        </div>

        {/* SPEC §4.4 — the policy gate, one row per required role */}
        {status === 'pending' && gate && gate.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {gate.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2"
              >
                <span className="text-sm font-medium text-ink">
                  {roleLabel(row.required_role_code)}
                </span>
                <Badge variant="outline" className={GATE_BADGE[row.status]}>
                  {row.status === 'pending' ? 'Waiting' : row.status}
                </Badge>
                {row.approver && (
                  <span className="text-xs text-ink-muted">
                    {row.approver.name}
                  </span>
                )}
                {row.notes && (
                  <span className="text-xs italic text-ink-muted">
                    &ldquo;{row.notes}&rdquo;
                  </span>
                )}
                {canDecide(row) && (
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="xs"
                      onClick={() =>
                        decideMutation.mutate({
                          approvalId: row.id,
                          decision: 'approve',
                        })
                      }
                      disabled={busy}
                    >
                      Approve
                    </Button>
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => {
                        setRejectingId(row.id);
                        setRejectDialogOpen(true);
                      }}
                      disabled={busy}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Reject one approval row — SPEC §6.4 makes the note mandatory */}
      <RejectionDialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) setRejectingId(null);
        }}
        onReject={(notes) => {
          if (rejectingId) {
            decideMutation.mutate({
              approvalId: rejectingId,
              decision: 'reject',
              notes,
            });
          }
        }}
        isSubmitting={decideMutation.isPending}
        subjectLabel="recipe"
      />

      {/* Withdraw confirmation dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back to draft?</DialogTitle>
            <DialogDescription>
              This recipe will return to draft status, the pending approval rows
              stop applying, and the author will need to re-submit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onStatusChange('draft');
                setWithdrawDialogOpen(false);
              }}
            >
              Send Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this recipe?</DialogTitle>
            <DialogDescription>
              Archive this recipe? It will be hidden from menus and marked as
              archived. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
            >
              Keep Recipe
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onStatusChange('archived');
                setArchiveDialogOpen(false);
              }}
            >
              Archive Recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create new version confirmation dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new version?</DialogTitle>
            <DialogDescription>
              Create a new version? The current approved recipe will be archived
              and a draft copy will be created for editing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVersionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onCreateVersion();
                setVersionDialogOpen(false);
              }}
            >
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
