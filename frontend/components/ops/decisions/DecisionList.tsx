'use client';

import { useState } from 'react';
import { AlertCircle, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
            className="h-[100px] animate-pulse rounded-lg bg-surface-raised motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <AlertCircle className="size-10 text-serious" />
        <p className="text-sm text-ink-muted">
          Can&apos;t load decisions right now. Try refreshing.
        </p>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <ClipboardList className="size-12 text-ink-muted" />
        <h2 className="text-xl font-semibold text-ink">No decisions yet</h2>
        <p className="max-w-sm text-sm text-ink-muted">
          Log your first decision to start building a clear record of the calls
          you&apos;ve made.
        </p>
        {onLogDecision && (
          <Button size="lg" className="mt-2" onClick={onLogDecision}>
            Log Decision
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-3">
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
              /**
               * The panel invalidates `['decisions']` itself; the row stays
               * expanded so the voter sees the new tally land.
               */
              onStatusChange={() => undefined}
            />
          )}
        </div>
      ))}
    </div>
  );
}
