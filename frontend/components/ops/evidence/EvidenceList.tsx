'use client';

import { FileQuestion } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EvidenceItem } from './EvidenceItem';
import type { Evidence } from '@/lib/types/evidence';

interface EvidenceListProps {
  evidence: Evidence[];
  currentUserId: string;
  isLoading: boolean;
  canApprove?: boolean;
  onApprovalAction?: () => void;
}

export function EvidenceList({
  evidence,
  currentUserId,
  isLoading,
  canApprove = false,
  onApprovalAction,
}: EvidenceListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="min-h-[48px]" />
        ))}
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FileQuestion className="size-10 text-muted-foreground mb-2 opacity-50" />
        <p className="text-sm text-muted-foreground">
          No evidence yet — upload a photo, document, or note to support this task.
        </p>
      </div>
    );
  }

  return (
    <div aria-live="polite">
      <div className="flex flex-col gap-1">
        {evidence.map((item) => (
          <EvidenceItem
            key={item.id}
            evidence={item}
            currentUserId={currentUserId}
            canApprove={
              canApprove && item.uploaded_by !== currentUserId
            }
            onApprovalAction={onApprovalAction}
          />
        ))}
      </div>
    </div>
  );
}
