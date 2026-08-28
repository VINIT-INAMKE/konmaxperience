'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileEdit,
  FileText,
  Image,
  Link as LinkIcon,
  Loader2,
  Video,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RejectionDialog } from './RejectionDialog';
import { EvidenceAssistPanel } from './EvidenceAssistPanel';
import { QuestTaskChip } from '@/components/ops/tasks/QuestTaskChip';
import { apiClient } from '@/lib/api-client';
import type { Evidence, EvidenceType } from '@/lib/types/evidence';
import { getEvidenceStatusBadge, STATUS_BADGE } from '@/lib/status-styles';

const TYPE_ICONS: Record<EvidenceType, typeof Image> = {
  image: Image,
  document: FileText,
  system: FileEdit,
  video: Video,
  link: LinkIcon,
  note: FileEdit,
};

const getStatusBadgeClass = getEvidenceStatusBadge;

function getDisplayName(evidence: Evidence): string {
  if (evidence.type === 'note') return 'Note';
  if (evidence.type === 'link') return evidence.url;
  // For file types, extract filename from URL
  const segments = evidence.url.split('/');
  return segments[segments.length - 1] || evidence.url;
}

/**
 * Bridge evidence stores an app-relative deep link (`/operations/…`) rather than
 * a presigned R2 URL, so it renders as an internal `<Link>`. Manual evidence
 * keeps the external anchor.
 */
function isInternalUrl(url: string): boolean {
  return url.startsWith('/');
}

interface EvidenceItemProps {
  evidence: Evidence;
  currentUserId: string;
  canApprove: boolean;
  uploadProgress?: number;
  onApprovalAction?: () => void;
  onXpUpdate?: (xp_total: number, level: number) => void;
}

export function EvidenceItem({
  evidence,
  canApprove,
  uploadProgress,
  onApprovalAction,
  onXpUpdate,
}: EvidenceItemProps) {
  const Icon = TYPE_ICONS[evidence.type] || FileText;
  const displayName = getDisplayName(evidence);
  const statusLabel =
    evidence.approval_status.charAt(0).toUpperCase() +
    evidence.approval_status.slice(1);
  const isBridge = evidence.source === 'bridge';

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const data = await apiClient.post<{
        valid: boolean;
        valid_xp: number;
        user?: { id: string; xp_total: number; level: number };
      }>(`/evidence/${evidence.id}/approve`);

      // Notify parent of new XP/level if backend returns user data
      if (data.user) {
        onXpUpdate?.(data.user.xp_total, data.user.level);
      }

      toast.success(
        data.valid_xp > 0
          ? `Task validated! +${data.valid_xp} XP earned.`
          : 'Evidence approved.',
      );
      onApprovalAction?.();
    } catch {
      toast.error('Failed to approve evidence.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (notes: string) => {
    setIsRejecting(true);
    try {
      await apiClient.post(`/evidence/${evidence.id}/reject`, { notes });
      toast.error('Evidence rejected.');
      setRejectDialogOpen(false);
      onApprovalAction?.();
    } catch {
      toast.error('Failed to reject evidence.');
    } finally {
      setIsRejecting(false);
    }
  };

  const linkClasses =
    'text-sm truncate max-w-[240px] text-left hover:underline underline-offset-4 hover:text-ink text-ink-muted transition-colors';

  return (
    <div className="relative space-y-1">
      <div className="flex min-h-[48px] items-center gap-4">
        <Icon className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />

        {evidence.type === 'note' ? (
          <span className="max-w-[240px] truncate text-left text-sm">
            {evidence.notes || 'Note'}
          </span>
        ) : isInternalUrl(evidence.url) ? (
          <Link
            href={evidence.url}
            className={linkClasses}
            onClick={(e) => e.stopPropagation()}
          >
            {displayName}
          </Link>
        ) : (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClasses}
            onClick={(e) => e.stopPropagation()}
          >
            {displayName}
          </a>
        )}

        {/* SPEC §4.2 — evidence the mission bridge captured, not a person */}
        {isBridge && (
          <Badge
            variant="outline"
            className={`gap-1 ${STATUS_BADGE.info}`}
            title={
              evidence.bridge_event
                ? `Auto-captured from ${evidence.bridge_event}`
                : 'Auto-captured by the mission bridge'
            }
          >
            <Zap aria-hidden="true" />
            Bridge
          </Badge>
        )}

        {uploadProgress !== undefined ? (
          <div className="ml-auto flex items-center gap-2">
            <div
              className="h-1 w-[120px] overflow-hidden rounded-full bg-surface-sunken"
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div
                className="h-full rounded-full bg-info-status transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-xs text-info-status">{uploadProgress}%</span>
          </div>
        ) : (
          <Badge
            variant="outline"
            className={`ml-auto shrink-0 ${getStatusBadgeClass(evidence.approval_status)}`}
          >
            {statusLabel}
          </Badge>
        )}

        {evidence.reviewer && (
          <span className="shrink-0 text-xs text-ink-muted">
            {evidence.reviewer.name}
          </span>
        )}

        {/* Approve / Reject actions */}
        {canApprove && evidence.approval_status === 'pending' && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={() => void handleApprove()}
              disabled={isApproving || isRejecting}
            >
              {isApproving ? (
                <>
                  <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                  Approving...
                </>
              ) : (
                'Approve'
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setRejectDialogOpen(true)}
              disabled={isApproving || isRejecting}
            >
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* SPEC §1.2 — the model's second opinion, strictly *below* the buttons
          above. It is offered only where a decision is actually open, and it
          receives no handle on the approve/reject controls: it cannot
          pre-select, disable or reorder them because it has nothing to do it
          with. A person decides. */}
      {canApprove && evidence.approval_status === 'pending' && (
        <EvidenceAssistPanel evidenceId={evidence.id} />
      )}

      {/* SPEC §6.4 — which task this proves, and the quest that asked for it. */}
      {evidence.task && (
        <div className="flex pl-9">
          <QuestTaskChip
            quest={evidence.task.quest}
            task={{ id: evidence.task.id, title: evidence.task.title }}
          />
        </div>
      )}

      {evidence.approval_status === 'rejected' && evidence.notes && (
        <div className="pl-9">
          <p className="text-sm italic text-ink-muted">
            <span className="text-xs not-italic text-serious">Rejected: </span>
            {evidence.notes}
          </p>
        </div>
      )}

      <RejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onReject={handleReject}
        isSubmitting={isRejecting}
      />
    </div>
  );
}
