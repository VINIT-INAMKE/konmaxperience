'use client';

import {
  Image,
  FileText,
  Video,
  Link as LinkIcon,
  FileEdit,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  uploadProgress?: number;
  onApprovalAction?: () => void;
}

export function EvidenceItem({
  evidence,
  uploadProgress,
}: EvidenceItemProps) {
  const Icon = TYPE_ICONS[evidence.type] || FileText;
  const displayName = getDisplayName(evidence);
  const statusLabel =
    evidence.approval_status.charAt(0).toUpperCase() +
    evidence.approval_status.slice(1);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4 min-h-[48px]">
        <Icon className="size-5 shrink-0 text-muted-foreground" />

        <Tooltip>
          <TooltipTrigger className="text-sm truncate max-w-[240px] text-left">
            {displayName}
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{evidence.url || evidence.notes}</p>
          </TooltipContent>
        </Tooltip>

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

        {/* Action buttons placeholder for Plan 04 */}
      </div>

      {evidence.approval_status === 'rejected' && evidence.notes && (
        <div className="pl-9">
          <p className="text-sm italic text-muted-foreground">
            <span className="text-[13px] text-red-400 not-italic">Rejected: </span>
            {evidence.notes}
          </p>
        </div>
      )}
    </div>
  );
}
