'use client';

import { ExternalLink } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DecisionStatusBadge } from './DecisionStatusBadge';
import { DecisionVotePanel } from './DecisionVotePanel';
import type { Decision } from '@/lib/types/decisions';
import { GOVERNANCE_TIER_LABELS } from '@/lib/types/decisions';

interface DecisionDetailProps {
  decision: Decision;
  /** Fired after a vote / resolve / reopen so the parent can refresh. */
  onStatusChange: () => void;
}

export function DecisionDetail({
  decision,
  onStatusChange,
}: DecisionDetailProps) {
  return (
    <Card className="space-y-4 border-line bg-surface p-6">
      {/* Status + tier */}
      <div className="flex flex-wrap items-center gap-2">
        <DecisionStatusBadge status={decision.status} />
        <Badge variant="outline" className="border-line text-ink-subtle">
          {GOVERNANCE_TIER_LABELS[decision.tier]}
        </Badge>
        {decision.impact_scope && (
          <span className="text-xs text-ink-muted">
            Impact: {decision.impact_scope}
          </span>
        )}
      </div>

      {/* Context section */}
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Context
        </p>
        <p className="text-base leading-relaxed text-ink">{decision.context}</p>
      </div>

      {/* Final decision, once it has one */}
      {decision.final_decision && (
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Final decision
          </p>
          <p className="text-base leading-relaxed text-ink">
            {decision.final_decision}
          </p>
        </div>
      )}

      {/* Links section */}
      {(decision.linked_mission_id ?? decision.linked_task_id) && (
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Links
          </p>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      )}

      {/* SPEC §4.4 — the vote panel replaces the old direct status PATCH */}
      <DecisionVotePanel decision={decision} onChanged={onStatusChange} />

      {/* History section */}
      <div className="space-y-2 border-t border-line pt-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          History
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-xs text-ink-muted">
            {formatDistanceToNow(parseISO(decision.updated_at), {
              addSuffix: true,
            })}
          </span>
          <span className="text-ink-muted">
            Status changed to {decision.status}
          </span>
        </div>
        {decision.resolved_at && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-xs text-ink-muted">
              {formatDistanceToNow(parseISO(decision.resolved_at), {
                addSuffix: true,
              })}
            </span>
            <span className="text-ink-muted">Resolved</span>
          </div>
        )}
      </div>
    </Card>
  );
}
