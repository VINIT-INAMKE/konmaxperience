'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Video, Link as LinkIcon, StickyNote, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE, getEvidenceStatusBadge } from '@/lib/status-styles';
import type { EvidenceFeedEntry } from '@/lib/types/analytics';

const STATUS_LABELS: Record<EvidenceFeedEntry['approval_status'], string> = {
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
};

function EvidenceThumbnail({
  type,
  url,
}: {
  type: EvidenceFeedEntry['type'];
  url: string;
}) {
  const iconClasses = 'size-6 text-muted-foreground';
  const wrapperClasses =
    'size-16 rounded-md overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center';

  if (type === 'image') {
    return (
      <div className="size-16 rounded-md overflow-hidden flex-shrink-0">
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  const Icon =
    type === 'video'
      ? Video
      : type === 'document'
        ? FileText
        : type === 'link'
          ? LinkIcon
          : StickyNote;

  return (
    <div className={wrapperClasses}>
      <Icon className={iconClasses} />
    </div>
  );
}

interface EvidenceFeedCardProps {
  evidence: EvidenceFeedEntry;
}

export function EvidenceFeedCard({ evidence }: EvidenceFeedCardProps) {
  const isBridge = evidence.source === 'bridge';

  return (
    <Link
      href={`/tasks/${evidence.task_id}`}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
    >
      <div className="flex gap-4 rounded-lg border bg-card p-4">
        <EvidenceThumbnail type={evidence.type} url={evidence.url} />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold truncate">
              {evidence.task?.title ?? 'Unknown task'}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
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
              <Badge
                variant="secondary"
                className={getEvidenceStatusBadge(evidence.approval_status)}
              >
                {STATUS_LABELS[evidence.approval_status]}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {isBridge
              ? 'Auto-captured by the mission bridge'
              : `Uploaded by ${evidence.uploader?.name ?? 'Unknown'}`}{' '}
            &middot;{' '}
            {formatDistanceToNow(new Date(evidence.created_at), {
              addSuffix: true,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Evidence type: {evidence.type}
          </p>
        </div>
      </div>
    </Link>
  );
}
