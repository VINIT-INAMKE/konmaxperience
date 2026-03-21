'use client';

import { useState } from 'react';
import { AlertCircle, ClipboardList } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { AnimatedList } from '@/components/ui/animated-list';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { DecisionCard } from './DecisionCard';
import { DecisionDetail } from './DecisionDetail';
import type { Decision } from '@/lib/types/decisions';

interface DecisionListProps {
  decisions: Decision[];
  isLoading: boolean;
  isError: boolean;
  newDecisionId: string | null;
  onLogDecision?: () => void;
}

export function DecisionList({
  decisions,
  isLoading,
  isError,
  newDecisionId,
  onLogDecision,
}: DecisionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[100px] bg-muted/50 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Couldn't load decisions. Refresh the page or try again.
        </p>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <ClipboardList className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No decisions yet</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Log the first decision to start building your governance trail.
        </p>
        {onLogDecision && (
          <ShimmerButton
            shimmerColor="#4ade80"
            className="mt-2 h-9 text-sm px-4"
            onClick={onLogDecision}
          >
            Log Decision
          </ShimmerButton>
        )}
      </div>
    );
  }

  return (
    <BlurFade>
      <AnimatedList delay={50} className="gap-3 items-stretch">
        {decisions.map((decision) => (
          <div key={decision.id} className="w-full space-y-2">
            <DecisionCard
              decision={decision}
              isExpanded={expandedId === decision.id}
              onToggle={() =>
                setExpandedId((prev) =>
                  prev === decision.id ? null : decision.id,
                )
              }
              isNew={decision.id === newDecisionId}
            />
            {expandedId === decision.id && (
              <DecisionDetail
                decision={decision}
                onStatusChange={() => {
                  // Parent page handles query invalidation via onStatusChange callback
                  setExpandedId(null);
                }}
              />
            )}
          </div>
        ))}
      </AnimatedList>
    </BlurFade>
  );
}
