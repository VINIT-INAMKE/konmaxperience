'use client';

import { CheckCircle, Circle } from 'lucide-react';
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { Badge } from '@/components/ui/badge';
import type { Task } from '@/lib/types/tasks';
import type { Evidence } from '@/lib/types/evidence';

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
          <Badge
            variant="secondary"
            className="text-green-400 bg-green-950 border-green-500/20"
          >
            Valid
          </Badge>
          <span className="text-[13px] text-green-400">Task validated</span>
        </div>
        <div className="flex justify-center">
          <AnimatedCircularProgressBar
            value={100}
            max={100}
            gaugePrimaryColor="hsl(142, 71%, 45%)"
            gaugeSecondaryColor="hsl(0, 0%, 20%)"
            className="size-20 text-sm"
            aria-label="Validation conditions met: 3 of 3"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h4 className="text-sm font-semibold">Validation required</h4>

      <div className="flex justify-center">
        <AnimatedCircularProgressBar
          value={Math.round((metCount / 3) * 100)}
          max={100}
          gaugePrimaryColor="hsl(142, 71%, 45%)"
          gaugeSecondaryColor="hsl(0, 0%, 20%)"
          className="size-20 text-sm"
          aria-label={`Validation conditions met: ${metCount} of 3`}
        />
      </div>

      <div role="list" className="space-y-2">
        {conditions.map((condition) => (
          <div key={condition.label} role="listitem" className="flex items-center gap-2">
            {condition.met ? (
              <CheckCircle
                className="size-4 text-green-400 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Circle
                className="size-4 text-muted-foreground shrink-0"
                aria-hidden="true"
              />
            )}
            <span
              className={`text-[13px] ${
                condition.met ? 'text-green-400' : 'text-muted-foreground'
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
