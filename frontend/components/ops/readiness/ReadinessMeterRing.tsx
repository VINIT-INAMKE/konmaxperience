'use client';

import { cn } from '@/lib/utils';
import { NumberTicker } from '@/components/ui/number-ticker';
import { MeterModeBadge } from './MeterModeBadge';
import { MeterRing } from './MeterRing';
import {
  METER_TONE_TEXT,
  METER_TONE_VAR,
  METER_TRACK_VAR,
  meterTone,
} from './meter-tone';
import type { ReadinessMeter } from '@/lib/types/readiness';

interface ReadinessMeterRingProps {
  meter: ReadinessMeter;
  mini?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function ReadinessMeterRing({
  meter,
  mini = false,
  selected = false,
  onClick,
}: ReadinessMeterRingProps) {
  const tone = meterTone(meter.current_value);
  const interactive = Boolean(onClick);
  const rounded = Math.round(meter.current_value);

  const body = (
    <>
      <div className={cn('relative', mini ? 'size-16' : 'size-40')}>
        <MeterRing
          value={meter.current_value}
          toneVar={METER_TONE_VAR[tone]}
          trackVar={METER_TRACK_VAR}
          strokeWidth={mini ? 10 : 8}
          label={`${meter.name}: ${rounded} percent`}
        />
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span
            className={cn(
              'font-semibold tabular-nums',
              METER_TONE_TEXT[tone],
              mini ? 'text-xs' : 'text-lg',
            )}
          >
            <NumberTicker
              value={meter.current_value}
              className={cn('font-semibold', METER_TONE_TEXT[tone])}
            />
            %
          </span>
        </div>
      </div>

      <span className="max-w-[130px] text-center text-sm leading-tight text-ink-muted">
        {meter.name}
      </span>

      {!mini && <MeterModeBadge mode={meter.mode} />}
    </>
  );

  if (!interactive) {
    return (
      <div className="flex flex-col items-center gap-2">{body}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${meter.name}: ${rounded}% ready`}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-xl p-2 transition-colors duration-200',
        'hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
        selected && 'bg-surface-raised ring-2 ring-brand',
      )}
    >
      {body}
    </button>
  );
}
