'use client';

import { formatDistanceToNow, parseISO } from 'date-fns';
import { Equal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  METER_TONE_FILL,
  METER_TONE_TEXT,
  meterTone,
} from './meter-tone';
import { HYBRID_PARTNER_METER, type ReadinessMeter } from '@/lib/types/readiness';

function relative(iso: string | null): string {
  if (!iso) return 'never';
  try {
    return `${formatDistanceToNow(parseISO(iso))} ago`;
  } catch {
    return 'never';
  }
}

function ValueBar({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: number | null;
}) {
  const resolved = value ?? 0;
  const tone = meterTone(resolved);

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-subtle">{label}</span>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            value === null ? 'text-ink-faint' : METER_TONE_TEXT[tone],
          )}
        >
          {value === null ? '—' : `${Math.round(resolved)}%`}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
        role="img"
        aria-label={`${label}: ${value === null ? 'not computed' : `${Math.round(resolved)} percent`}`}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', METER_TONE_FILL[tone])}
          style={{ width: `${Math.min(100, Math.max(0, resolved))}%` }}
        />
      </div>
      <p className="text-[11px] leading-tight text-ink-faint">{hint}</p>
    </div>
  );
}

interface MeterBreakdownProps {
  meter: ReadinessMeter;
}

/**
 * Makes the published `current_value` legible: which half came from validated
 * tasks, which half from the formula, and when the formula last ran. A
 * `task_driven` meter has nothing to explain, so it renders nothing.
 */
export function MeterBreakdown({ meter }: MeterBreakdownProps) {
  if (meter.mode === 'task_driven') return null;

  const computedAt = relative(meter.last_computed_at);
  const currentTone = meterTone(meter.current_value);

  if (meter.mode === 'derived') {
    return (
      <section className="rounded-lg border border-line bg-surface-raised/60 p-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-xs font-medium text-ink-subtle">
              Derived from operations
            </p>
            <p
              className={cn(
                'mt-0.5 text-3xl font-semibold tabular-nums',
                meter.derived_value === null
                  ? 'text-ink-faint'
                  : METER_TONE_TEXT[currentTone],
              )}
            >
              {meter.derived_value === null
                ? '—'
                : `${Math.round(meter.derived_value)}%`}
              <span className="ml-1.5 text-sm font-normal text-ink-muted">
                of {Math.round(meter.target_value)}% target
              </span>
            </p>
          </div>
          <dl className="text-right text-xs text-ink-muted">
            <div className="flex items-baseline justify-end gap-2">
              <dt>Formula</dt>
              <dd className="font-mono text-ink-subtle">
                {meter.formula_key ?? 'none'}
              </dd>
            </div>
            <div className="mt-1 flex items-baseline justify-end gap-2">
              <dt>Updated</dt>
              <dd className="text-ink-subtle">{computedAt}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          No task moves this meter directly. It is recomputed from live
          operations data every night, and on demand from Recompute now.
        </p>
      </section>
    );
  }

  const partner = meter.formula_key
    ? HYBRID_PARTNER_METER[meter.formula_key]
    : undefined;

  return (
    <section className="rounded-lg border border-line bg-surface-raised/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <p className="text-xs font-medium text-ink-subtle">
          50 / 50 blend
          {partner ? (
            <span className="font-normal text-ink-muted">
              {' '}
              with {partner} Readiness
            </span>
          ) : null}
        </p>
        <p className="text-xs text-ink-muted">
          Updated <span className="text-ink-subtle">{computedAt}</span>
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <ValueBar
          label="Task-driven"
          hint="Validated task contributions"
          value={meter.task_value}
        />
        <Plus
          aria-hidden="true"
          className="hidden size-4 shrink-0 self-center text-ink-faint sm:block"
        />
        <ValueBar
          label="Derived"
          hint={
            meter.derived_value === null
              ? 'Not computed yet'
              : 'Formula over operations state'
          }
          value={meter.derived_value}
        />
        <Equal
          aria-hidden="true"
          className="hidden size-4 shrink-0 self-center text-ink-faint sm:block"
        />
        <div className="shrink-0 rounded-md border border-line bg-surface px-3 py-2 text-center sm:min-w-28">
          <p className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">
            Published
          </p>
          <p
            className={cn(
              'text-2xl font-semibold tabular-nums',
              METER_TONE_TEXT[currentTone],
            )}
          >
            {Math.round(meter.current_value)}%
          </p>
        </div>
      </div>
    </section>
  );
}
