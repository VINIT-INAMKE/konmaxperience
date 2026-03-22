'use client';

import { FileQuestion } from 'lucide-react';
import { AnimatedList } from '@/components/ui/animated-list';
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
          <div
            key={i}
            className="min-h-[48px] rounded-md bg-muted/50 animate-pulse"
          />
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
      <AnimatedList delay={50} className="gap-1">
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
      </AnimatedList>
    </div>
  );
}
