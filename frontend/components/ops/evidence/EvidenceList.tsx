'use client';

import { FileQuestion } from 'lucide-react';
import { AnimatedList } from '@/components/ui/animated-list';
import { EvidenceItem } from './EvidenceItem';
import type { Evidence } from '@/lib/types/evidence';

interface EvidenceListProps {
  evidence: Evidence[];
  currentUserId: string;
  isLoading: boolean;
}

export function EvidenceList({
  evidence,
  currentUserId,
  isLoading,
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
          No evidence submitted yet.
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
          />
        ))}
      </AnimatedList>
    </div>
  );
}
