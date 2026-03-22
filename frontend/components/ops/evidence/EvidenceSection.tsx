'use client';

import { useState, useRef, useEffect } from 'react';
import { FileQuestion } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { AnimatedList } from '@/components/ui/animated-list';
import { Card, CardContent } from '@/components/ui/card';
import { ValidationStatus } from './ValidationStatus';
import { EvidenceUploadZone } from './EvidenceUploadZone';
import { EvidenceItem } from './EvidenceItem';
import { LinkEvidenceForm } from './LinkEvidenceForm';
import { NoteEvidenceForm } from './NoteEvidenceForm';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Task } from '@/lib/types/tasks';
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
      toast.success(`Task validated! +${task.valid_xp} XP`);
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
              <div
                key={i}
                className="min-h-[48px] rounded-md bg-muted/50 animate-pulse"
              />
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
            <AnimatedList delay={50} className="gap-1">
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
            </AnimatedList>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

