'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { FileQuestion, ShieldCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ValidationStatus } from './ValidationStatus';
import { EvidenceUploadZone } from './EvidenceUploadZone';
import { EvidenceItem } from './EvidenceItem';
import { LinkEvidenceForm } from './LinkEvidenceForm';
import { NoteEvidenceForm } from './NoteEvidenceForm';
import { InlineDecision } from '@/components/ops/approvals/InlineDecision';
import { ApprovalEntityChip } from '@/components/ops/approvals/ApprovalEntityChip';
import { apiClient } from '@/lib/api-client';
import { optionalGet } from '@/lib/api/optional';
import { trackAction } from '@/lib/usage';
import { USAGE_ACTIONS } from '@/lib/types/usage';
import { P31 } from '@/lib/api/phase31';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Task } from '@/lib/types/tasks';
import type { Approval } from '@/lib/types/approvals';
import { APPROVAL_ENTITY_LABELS } from '@/lib/types/approvals';
import type { Evidence } from '@/lib/types/evidence';

interface EvidenceSectionProps {
  task: Task;
  isOwn: boolean;
  isAdmin: boolean;
}

export function EvidenceSection({ task, isOwn, isAdmin }: EvidenceSectionProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const updateXpAndLevel = useAuthStore((s) => s.updateXpAndLevel);
  const triggerLevelUp = useAuthStore((s) => s.triggerLevelUp);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);

  // Track previous valid state for transition detection
  const prevValidRef = useRef(task.valid);

  const {
    data: evidence,
    isLoading: evidenceLoading,
  } = useQuery({
    queryKey: ['evidence', task.id],
    queryFn: () => apiClient.get<Evidence[]>(`/tasks/${task.id}/evidence`),
  });

  /**
   * SPEC §6.4 — the approvals this viewer owes on *this* task, decided in place.
   * `/approvals` is gated behind `APPROVE_EVIDENCE`, so a 403 is an ordinary
   * outcome for most roles: `optionalGet` turns it into `null` and the block
   * simply does not render. The key sits under `['approvals','pending', …]`
   * because that is the prefix `InlineDecision` patches optimistically.
   */
  const { data: myApprovals } = useQuery({
    queryKey: ['approvals', 'pending', 'mine'],
    queryFn: () => optionalGet<Approval[]>(P31.myPendingApprovals),
  });

  const evidenceIds = useMemo(
    () => new Set((evidence ?? []).map((item) => item.id)),
    [evidence],
  );

  const taskApprovals = useMemo(
    () =>
      (myApprovals ?? []).filter(
        (row) =>
          (row.entity_type === 'task' && row.entity_id === task.id) ||
          (row.entity_type === 'evidence' && evidenceIds.has(row.entity_id)),
      ),
    [myApprovals, evidenceIds, task.id],
  );

  // Detect task.valid transition: false -> true
  useEffect(() => {
    if (task.valid && !prevValidRef.current) {
      // Fire confetti
      void confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
      });

      // Fire toast
      const readinessMsg = task.readiness_meter_id && task.readiness_value > 0
        ? ` \u00b7 +${task.readiness_value} ${task.readiness_meter?.name ?? 'Readiness'}`
        : '';
      trackAction(USAGE_ACTIONS.TASK_VALIDATE, { task_id: task.id });
      toast.success(`Task validated! +${task.valid_xp} XP${readinessMsg}`);
    }
    prevValidRef.current = task.valid;
  }, [task.valid, task.valid_xp]);

  // Determine if current user can approve evidence
  // Admin and leads can approve (backend enforces APPROVE_EVIDENCE permission)
  const canApproveRole =
    isAdmin ||
    (user?.roleCode !== undefined &&
      user.roleCode !== RoleCode.FOUNDER_ADMIN &&
      user.roleCode.endsWith('_LEAD'));

  const handleEvidenceChange = () => {
    trackAction(USAGE_ACTIONS.EVIDENCE_UPLOAD, { from: 'task_page' });
    void queryClient.invalidateQueries({ queryKey: ['evidence', task.id] });
    void queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
    if (task.quest_id) {
      void queryClient.invalidateQueries({
        queryKey: ['quests', task.quest_id],
      });
    }
    setShowLinkForm(false);
    setShowNoteForm(false);
  };

  const handleXpUpdate = (xp_total: number, level: number) => {
    const prevLevel = useAuthStore.getState().user?.level ?? 1;
    updateXpAndLevel(xp_total, level);
    if (level > prevLevel) {
      triggerLevelUp(level);
    }
  };

  const handleApprovalAction = () => {
    void queryClient.invalidateQueries({ queryKey: ['evidence', task.id] });
    void queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
    if (task.quest_id) {
      void queryClient.invalidateQueries({
        queryKey: ['quests', task.quest_id],
      });
    }
    // Also invalidate approvals for sidebar badge
    void queryClient.invalidateQueries({ queryKey: ['approvals'] });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Evidence</h3>
          {evidence && evidence.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {evidence.length} {evidence.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        <ValidationStatus task={task} evidence={evidence ?? []} />

        {taskApprovals.length > 0 && (
          <section
            aria-label="Approvals waiting on you"
            className="space-y-3 rounded-lg border border-[var(--status-warning)]/25 bg-[var(--status-warning)]/10 p-3"
          >
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--status-warning)]">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Waiting on your sign-off
            </h4>
            {taskApprovals.map((approval) => (
              <div key={approval.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ApprovalEntityChip entityType={approval.entity_type} />
                  <span className="text-sm font-medium text-ink">
                    {approval.subject?.title ??
                      APPROVAL_ENTITY_LABELS[approval.entity_type]}
                  </span>
                </div>
                <InlineDecision
                  approvalId={approval.id}
                  size="xs"
                  subjectLabel={APPROVAL_ENTITY_LABELS[
                    approval.entity_type
                  ].toLowerCase()}
                  extraInvalidateKeys={[['tasks', task.id]]}
                  onDecided={handleApprovalAction}
                />
              </div>
            ))}
          </section>
        )}

        {(isOwn || isAdmin) && (
          <EvidenceUploadZone
            taskId={task.id}
            onUploadComplete={handleEvidenceChange}
            onShowLinkForm={() => {
              setShowLinkForm(true);
              setShowNoteForm(false);
            }}
            onShowNoteForm={() => {
              setShowNoteForm(true);
              setShowLinkForm(false);
            }}
          />
        )}

        {showLinkForm && (
          <LinkEvidenceForm
            taskId={task.id}
            onSubmit={handleEvidenceChange}
            onCancel={() => setShowLinkForm(false)}
          />
        )}

        {showNoteForm && (
          <NoteEvidenceForm
            taskId={task.id}
            onSubmit={handleEvidenceChange}
            onCancel={() => setShowNoteForm(false)}
          />
        )}

        {evidenceLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="min-h-[48px]" />
            ))}
          </div>
        ) : !evidence || evidence.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileQuestion className="size-10 text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No evidence submitted yet.
            </p>
          </div>
        ) : (
          <div aria-live="polite">
            <div className="flex flex-col gap-1">
              {evidence.map((item) => (
                <EvidenceItem
                  key={item.id}
                  evidence={item}
                  currentUserId={user?.id ?? ''}
                  canApprove={
                    canApproveRole &&
                    item.uploaded_by !== user?.id
                  }
                  onApprovalAction={handleApprovalAction}
                  onXpUpdate={handleXpUpdate}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

