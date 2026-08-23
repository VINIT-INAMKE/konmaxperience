'use client';

import { Lock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DecisionStatusBadge } from './DecisionStatusBadge';
import { DecisionTypeBadge } from './DecisionTypeBadge';
import type { Decision } from '@/lib/types/decisions';
import { GOVERNANCE_TIER_SHORT_LABELS } from '@/lib/types/decisions';

interface DecisionCardProps {
  decision: Decision;
  isExpanded: boolean;
  onToggle: () => void;
  isNew?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function DecisionCard({
  decision,
  isExpanded,
  onToggle,
  isNew = false,
}: DecisionCardProps) {
  const proposerName = decision.proposer?.name ?? 'Unknown';
  const relativeTime = formatDistanceToNow(parseISO(decision.created_at), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        'cursor-pointer space-y-2 rounded-lg border bg-surface p-4 transition-colors hover:bg-accent',
        isExpanded ? 'border-brand/50' : 'border-line',
        isNew && 'ring-2 ring-good/60',
      )}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onToggle();
      }}
      aria-expanded={isExpanded}
      aria-label={`Decision: ${decision.title}, status: ${decision.status}, type: ${decision.decision_type}`}
    >
      {/* Row 1: title + lock icon + tier + type badge + status badge */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-ink">
          {decision.title}
        </span>
        {decision.status === 'approved' && (
          <Lock
            className="size-3.5 shrink-0 text-ink-muted"
            aria-label="Locked decision"
          />
        )}
        <Badge variant="outline" className="border-line text-ink-subtle">
          {GOVERNANCE_TIER_SHORT_LABELS[decision.tier]}
        </Badge>
        <DecisionTypeBadge type={decision.decision_type} />
        <DecisionStatusBadge status={decision.status} />
      </div>

      {/* Row 2: context preview */}
      <p className="line-clamp-2 text-sm text-ink-muted">{decision.context}</p>

      {/* Row 3: linked entities + proposer + timestamp */}
      <div className="flex flex-wrap items-center gap-2">
        {decision.linked_mission && (
          <Badge variant="outline" className="gap-1 text-xs">
            <ExternalLink className="size-3" aria-hidden="true" />
            {decision.linked_mission.title}
          </Badge>
        )}
        {decision.linked_task && (
          <Badge variant="outline" className="gap-1 text-xs">
            <ExternalLink className="size-3" aria-hidden="true" />
            {decision.linked_task.title}
          </Badge>
        )}
        <div className="flex items-center gap-1.5">
          <Avatar className="size-5">
            <AvatarFallback className="text-[10px]">
              {getInitials(proposerName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-ink-muted">{proposerName}</span>
        </div>
        <span className="ml-auto text-sm text-ink-muted">{relativeTime}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? 'Hide Detail' : 'View Detail'}
        </Button>
      </div>
    </div>
  );
}
