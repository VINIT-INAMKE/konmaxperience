'use client';

import { CheckCircle, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MeterRing } from '@/components/ops/readiness/MeterRing';
import { METER_TRACK_VAR } from '@/components/ops/readiness/meter-tone';
import type { Task } from '@/lib/types/tasks';
import type { Evidence } from '@/lib/types/evidence';
import { STATUS_BADGE } from '@/lib/status-styles';

interface ValidationStatusProps {
  task: Task;
  evidence: Evidence[];
}

export function ValidationStatus({ task, evidence }: ValidationStatusProps) {
  const statusDone = task.status === 'done';
  const hasApprovedEvidence = evidence.some(
    (e) => e.approval_status === 'approved',
  );
  // For v1, third condition is met if hasApprovedEvidence is true
  // (server-side validateTask is authoritative)
  const approvalsSatisfied = hasApprovedEvidence;

  const conditions = [
    { label: 'Status is Done', met: statusDone },
    { label: 'At least one evidence approved', met: hasApprovedEvidence },
    { label: 'All required approvals satisfied', met: approvalsSatisfied },
  ];

  const metCount = conditions.filter((c) => c.met).length;

  if (task.valid) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={STATUS_BADGE.good}>
            Valid
          </Badge>
          <span className="text-xs text-good">Task validated</span>
        </div>
        <div className="flex justify-center">
          <div className="relative size-20">
            <MeterRing
              value={100}
              toneVar="var(--status-good)"
              trackVar={METER_TRACK_VAR}
              label="Validation conditions met: 3 of 3"
            />
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-good"
              aria-hidden="true"
            >
              3/3
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h4 className="text-sm font-semibold">Validation required</h4>

      <div className="flex justify-center">
        <div className="relative size-20">
          <MeterRing
            value={Math.round((metCount / 3) * 100)}
            toneVar={metCount === 3 ? 'var(--status-good)' : 'var(--status-warning)'}
            trackVar={METER_TRACK_VAR}
            label={`Validation conditions met: ${metCount} of 3`}
          />
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-ink-subtle"
            aria-hidden="true"
          >
            {metCount}/3
          </span>
        </div>
      </div>

      <div role="list" className="space-y-2">
        {conditions.map((condition) => (
          <div key={condition.label} role="listitem" className="flex items-center gap-2">
            {condition.met ? (
              <CheckCircle
                className="size-4 text-good shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Circle
                className="size-4 text-muted-foreground shrink-0"
                aria-hidden="true"
              />
            )}
            <span
              className={`text-xs ${
                condition.met ? 'text-good' : 'text-muted-foreground'
              }`}
            >
              {condition.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
