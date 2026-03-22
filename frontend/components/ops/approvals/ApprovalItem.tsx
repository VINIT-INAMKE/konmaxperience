'use client';

import { useState } from 'react';
import {
  Image,
  FileText,
  Video,
  Link as LinkIcon,
  FileEdit,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { PulsatingButton } from '@/components/ui/pulsating-button';
import { AvatarCircles } from '@/components/ui/avatar-circles';
import { RejectionDialog } from '@/components/ops/evidence/RejectionDialog';
import { OverrideDialog } from './OverrideDialog';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Evidence, EvidenceType } from '@/lib/types/evidence';

const TYPE_ICONS: Record<EvidenceType, typeof Image> = {
  photo: Image,
  doc: FileText,
  video: Video,
  link: LinkIcon,
  note: FileEdit,
};

function getDisplayName(evidence: Evidence): string {
  if (evidence.type === 'note') return 'Note';
  if (evidence.type === 'link') return evidence.url;
  const segments = evidence.url.split('/');
  return segments[segments.length - 1] || evidence.url;
}

interface ApprovalEvidence extends Evidence {
  task?: {
    id: string;
    title: string;
    quest?: { id: string; title: string } | null;
    mission?: { id: string; title: string } | null;
  };
  // Override fields (present when this evidence was approved via override)
  override_by?: string | null;
  override_reason?: string | null;
  override_at?: string | null;
  overrider?: { id: string; name: string } | null;
  delegated_from_user_id?: string | null;
  delegated_from_user?: { id: string; name: string } | null;
}

interface ApprovalItemProps {
  evidence: ApprovalEvidence;
  onAction: () => void;
}

export function ApprovalItem({ evidence, onAction }: ApprovalItemProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const Icon = TYPE_ICONS[evidence.type] || FileText;
  const displayName = getDisplayName(evidence);

  const isPendingLong =
    Date.now() - new Date(evidence.created_at).getTime() > 24 * 60 * 60 * 1000;
  const pendingDays = Math.floor(
    (Date.now() - new Date(evidence.created_at).getTime()) /
      (24 * 60 * 60 * 1000),
  );

  const uploaderAvatars = evidence.uploader
    ? [
        {
          imageUrl: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(evidence.uploader.name)}`,
          profileUrl: '#',
        },
      ]
    : [];

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await apiClient.post(`/evidence/${evidence.id}/approve`);
      toast.success('Approved!');
      onAction();
    } catch {
      toast.error('Couldn\'t approve that — try again.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (notes: string) => {
    setIsRejecting(true);
    try {
      await apiClient.post(`/evidence/${evidence.id}/reject`, { notes });
      toast.success('Feedback sent.');
      setRejectDialogOpen(false);
      onAction();
    } catch {
      toast.error('Couldn\'t send feedback — try again.');
    } finally {
      setIsRejecting(false);
    }
  };

  const actionButtons = (
    <div className="flex items-center gap-2">
      <ShimmerButton
          className="h-8 text-xs"
          shimmerColor="#4ade80"
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
        </ShimmerButton>
      <InteractiveHoverButton
        className="h-8 px-3 text-xs border-red-500/30 hover:bg-red-950"
        onClick={() => setRejectDialogOpen(true)}
      >
        Reject
      </InteractiveHoverButton>
      {isAdmin && (
        <>
          <div className="w-px h-4 bg-border" />
          {isPendingLong ? (
            <PulsatingButton
              pulseColor="#f59e0b"
              duration="2s"
              className="h-8 px-3 text-xs bg-transparent border border-amber-500/30 text-amber-400 shadow-none"
              onClick={() => setOverrideDialogOpen(true)}
            >
              Override
            </PulsatingButton>
          ) : (
            <InteractiveHoverButton
              className="h-8 px-3 text-xs border-amber-500/30"
              onClick={() => setOverrideDialogOpen(true)}
            >
              Override
            </InteractiveHoverButton>
          )}
        </>
      )}
    </div>
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        {/* Row 1: Task title, quest, mission */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">
            {evidence.task?.title || 'Unknown task'}
          </span>
          {evidence.task?.quest && (
            <span className="text-xs text-muted-foreground">
              {evidence.task.quest.title}
            </span>
          )}
          {evidence.task?.mission && (
            <span className="text-xs text-muted-foreground">
              {evidence.task.mission.title}
            </span>
          )}
        </div>

        {/* Row 2: Type icon, filename, uploader, submitted time */}
        <div className="flex items-center gap-3 flex-wrap">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          {evidence.type === 'note' ? (
            <span className="text-sm truncate max-w-[200px] text-left">
              {evidence.notes || 'Note'}
            </span>
          ) : (
            <a
              href={evidence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm truncate max-w-[200px] text-left hover:underline underline-offset-4 hover:text-foreground text-muted-foreground transition-colors"
            >
              {displayName}
            </a>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <AvatarCircles
              avatarUrls={uploaderAvatars}
              className="[&_img]:h-6 [&_img]:w-6"
            />
            <span className="text-xs text-muted-foreground">
              {evidence.uploader?.name || 'Unknown'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            Submitted:{' '}
            {formatDistanceToNow(parseISO(evidence.created_at), {
              addSuffix: true,
            })}
          </span>
        </div>

        {/* Row 3: Actions */}
        <div className="flex items-center gap-2 pt-1">
          {isPendingLong ? (
            <Tooltip>
              <TooltipTrigger className="flex items-center">
                <PulsatingButton
                  pulseColor="#f59e0b"
                  duration="2s"
                  className="bg-transparent p-0 shadow-none"
                >
                  {actionButtons}
                </PulsatingButton>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Pending for {pendingDays} {pendingDays === 1 ? 'day' : 'days'}
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            actionButtons
          )}
        </div>

        {/* Override attribution row */}
        {evidence.override_reason && (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-3 text-amber-400 shrink-0" />
            <span className="text-muted-foreground italic text-sm">
              Overridden by {evidence.overrider?.name || 'Admin'} &mdash;{' '}
              {evidence.override_reason}
            </span>
            {evidence.override_at && (
              <span className="text-muted-foreground text-xs ml-auto shrink-0">
                {formatDistanceToNow(parseISO(evidence.override_at), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        )}

        {/* Delegation attribution row */}
        {evidence.delegated_from_user_id && evidence.delegated_from_user && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-sm">
              Approved by {evidence.reviewer?.name || 'Unknown'} (on behalf of{' '}
              {evidence.delegated_from_user.name})
            </span>
          </div>
        )}
      </CardContent>

      <RejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onReject={handleReject}
        isSubmitting={isRejecting}
      />

      {isAdmin && (
        <OverrideDialog
          open={overrideDialogOpen}
          onOpenChange={setOverrideDialogOpen}
          evidenceId={evidence.id}
          onOverridden={onAction}
        />
      )}
    </Card>
  );
}
