'use client';

import { useState, useEffect } from 'react';
import { Lock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/ui/magic-card';
import { ShineBorder } from '@/components/ui/shine-border';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { DecisionStatusBadge } from './DecisionStatusBadge';
import { DecisionTypeBadge } from './DecisionTypeBadge';
import type { Decision } from '@/lib/types/decisions';

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
  const [showShine, setShowShine] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      setShowShine(true);
      const timer = setTimeout(() => setShowShine(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const proposerName = decision.proposer?.name || 'Unknown';
  const relativeTime = formatDistanceToNow(parseISO(decision.created_at), {
    addSuffix: true,
  });

  return (
    <div className="relative rounded-lg" onClick={onToggle} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
      aria-label={`Decision: ${decision.title}, status: ${decision.status}, type: ${decision.decision_type}`}
    >
      {showShine && (
        <ShineBorder
          shineColor={['#4ade80', '#22d3ee', '#a78bfa']}
          duration={3}
          borderWidth={2}
        />
      )}
      <MagicCard
        gradientColor="#1a1a2e"
        className="p-4 space-y-2 cursor-pointer hover:bg-muted/20 transition-colors"
      >
        {/* Row 1: title + lock icon + type badge + status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-semibold">{decision.title}</span>
          {decision.status === 'approved' && (
            <Lock
              className="size-3.5 text-muted-foreground shrink-0"
              aria-label="Locked decision"
            />
          )}
          <DecisionTypeBadge type={decision.decision_type} />
          <DecisionStatusBadge status={decision.status} />
        </div>

        {/* Row 2: context preview */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {decision.context}
        </p>

        {/* Row 3: linked entities + proposer + timestamp */}
        <div className="flex items-center gap-2 flex-wrap">
          {decision.linked_mission && (
            <Badge variant="outline" className="text-xs gap-1">
              <ExternalLink className="size-3" />
              {decision.linked_mission.title}
            </Badge>
          )}
          {decision.linked_task && (
            <Badge variant="outline" className="text-xs gap-1">
              <ExternalLink className="size-3" />
              {decision.linked_task.title}
            </Badge>
          )}
          <div className="flex items-center gap-1.5">
            <Avatar className="size-5">
              <AvatarFallback className="text-[10px]">
                {getInitials(proposerName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{proposerName}</span>
          </div>
          <span className="text-sm text-muted-foreground ml-auto">
            {relativeTime}
          </span>
          <InteractiveHoverButton
            className="h-7 text-xs px-3"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            View Detail
          </InteractiveHoverButton>
        </div>
      </MagicCard>
    </div>
  );
}
