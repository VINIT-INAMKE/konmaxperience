import { Check, CircleDashed, CircleSlash, Dot } from 'lucide-react';

import { formatDateTime } from '@/lib/format/date';
import { cn } from '@/lib/utils';

import type { TimelineStep, TimelineStepState } from './track-model';

/**
 * The one vertical rail every group on the track page draws — the kitchen
 * rail, each booking rail and the parcel rail all render through here, so the
 * three presentations differ in their *steps* and never in their appearance.
 *
 * The five states are distinguished by **shape and weight, not hue alone**
 * (`DESIGN-02`): a reached step carries a filled dot and a tick, the live step
 * a ring, a step ahead an outline, a skipped step a dashed outline with its
 * caption, and a stopped step a struck circle. That keeps the rail legible to a
 * colour-blind reader and in a printed receipt.
 */

const DOT: Record<TimelineStepState, string> = {
  done: 'border-transparent bg-leaf text-leaf-ink',
  current: 'border-brand bg-brand text-brand-ink ring-4 ring-brand-soft',
  pending: 'border-line-strong bg-surface text-ink-faint',
  skipped: 'border-dashed border-line-strong bg-surface text-ink-faint',
  cancelled: 'border-line-strong bg-surface-raised text-ink-muted',
};

const LABEL: Record<TimelineStepState, string> = {
  done: 'text-ink-strong',
  current: 'text-ink-strong',
  pending: 'text-ink-muted',
  skipped: 'text-ink-muted',
  cancelled: 'text-ink-muted line-through',
};

function StepIcon({ state }: { state: TimelineStepState }) {
  if (state === 'done') return <Check className="size-3.5" aria-hidden="true" />;
  if (state === 'current') return <Dot className="size-5" aria-hidden="true" />;
  if (state === 'cancelled') return <CircleSlash className="size-3.5" aria-hidden="true" />;
  if (state === 'skipped') return <CircleDashed className="size-3.5" aria-hidden="true" />;
  return <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />;
}

export interface TimelineRailProps {
  steps: readonly TimelineStep[];
  className?: string;
}

export function TimelineRail({ steps, className }: TimelineRailProps) {
  return (
    <ol data-slot="timeline-rail" className={cn('space-y-0', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const connectorDone = step.state === 'done';

        return (
          <li
            key={step.key}
            className="flex gap-3"
            {...(step.state === 'current' ? { 'aria-current': 'step' as const } : {})}
          >
            <div className="flex w-6 shrink-0 flex-col items-center">
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border',
                  DOT[step.state],
                )}
              >
                <StepIcon state={step.state} />
              </span>
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-px flex-1',
                    connectorDone ? 'bg-leaf/50' : 'bg-line',
                  )}
                />
              ) : null}
            </div>

            <div className={cn('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-6')}>
              <p className={cn('text-sm font-medium leading-6', LABEL[step.state])}>
                {step.label}
              </p>
              {step.at ? (
                <p className="text-xs text-ink-muted tabular-nums">{formatDateTime(step.at)}</p>
              ) : null}
              {step.note ? <p className="text-xs text-ink-faint">{step.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
