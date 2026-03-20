'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Image,
  FileText,
  Video,
  Link as LinkIcon,
  FileEdit,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { CoolMode } from '@/components/ui/cool-mode';
import { ShineBorder } from '@/components/ui/shine-border';
import { RejectionDialog } from './RejectionDialog';
import { apiClient } from '@/lib/api-client';
import type { Evidence, EvidenceType } from '@/lib/types/evidence';

const TYPE_ICONS: Record<EvidenceType, typeof Image> = {
  photo: Image,
  doc: FileText,
  video: Video,
  link: LinkIcon,
  note: FileEdit,
};

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'pending':
      return 'text-amber-400 bg-amber-950 border-amber-500/20';
    case 'approved':
      return 'text-green-400 bg-green-950 border-green-500/20';
    case 'rejected':
      return 'text-red-400 bg-red-950 border-red-500/20';
    default:
      return '';
  }
}

function getDisplayName(evidence: Evidence): string {
  if (evidence.type === 'note') return 'Note';
  if (evidence.type === 'link') return evidence.url;
  // For file types, extract filename from URL
  const segments = evidence.url.split('/');
  return segments[segments.length - 1] || evidence.url;
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

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [showShine, setShowShine] = useState(false);

  // Show shine border for 3 seconds after approval
  useEffect(() => {
    if (showShine) {
      const timer = setTimeout(() => setShowShine(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showShine]);

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
      setShowShine(true);
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

  return (
    <div className="relative space-y-1">
      {showShine && (
        <ShineBorder
          shineColor={['#4ade80', '#22c55e']}
          borderWidth={2}
          duration={3}
        />
      )}

      <div className="flex items-center gap-4 min-h-[48px]">
        <Icon className="size-5 shrink-0 text-muted-foreground" />

        {evidence.type === 'note' ? (
          <span className="text-sm truncate max-w-[240px] text-left">
            {evidence.notes || 'Note'}
          </span>
        ) : (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm truncate max-w-[240px] text-left hover:underline underline-offset-4 hover:text-foreground text-muted-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {displayName}
          </a>
        )}

        {uploadProgress !== undefined ? (
          <div className="flex items-center gap-2 ml-auto">
            <div
              className="w-[120px] h-1 bg-muted rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div
                className="h-full bg-blue-400 transition-all duration-200 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-[13px] text-blue-400">{uploadProgress}%</span>
          </div>
        ) : (
          <Badge
            variant="secondary"
            className={`ml-auto shrink-0 ${getStatusBadgeClass(evidence.approval_status)}`}
          >
            {statusLabel}
          </Badge>
        )}

        {evidence.reviewer && (
          <span className="text-[13px] text-muted-foreground shrink-0">
            {evidence.reviewer.name}
          </span>
        )}

        {/* Approve / Reject actions */}
        {canApprove && evidence.approval_status === 'pending' && (
          <div className="flex items-center gap-2 shrink-0">
            <CoolMode>
              <InteractiveHoverButton
                className="h-8 px-3 text-xs border-green-500/30 hover:bg-green-950"
                onClick={() => void handleApprove()}
                disabled={isApproving}
              >
                {isApproving ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                    Approving...
                  </span>
                ) : (
                  'Approve'
                )}
              </InteractiveHoverButton>
            </CoolMode>
            <InteractiveHoverButton
              className="h-8 px-3 text-xs border-red-500/30 hover:bg-red-950"
              onClick={() => setRejectDialogOpen(true)}
            >
              Reject
            </InteractiveHoverButton>
          </div>
        )}
      </div>

      {evidence.approval_status === 'rejected' && evidence.notes && (
        <div className="pl-9">
          <p className="text-sm italic text-muted-foreground">
            <span className="text-[13px] text-red-400 not-italic">Rejected: </span>
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
