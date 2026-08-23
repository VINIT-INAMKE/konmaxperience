'use client';

import { cn } from '@/lib/utils';
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { NumberTicker } from '@/components/ui/number-ticker';
import { MeterModeBadge } from './MeterModeBadge';
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

  const body = (
    <>
      <div className="relative">
        <AnimatedCircularProgressBar
          value={meter.current_value}
          gaugePrimaryColor={METER_TONE_VAR[tone]}
          gaugeSecondaryColor={METER_TRACK_VAR}
          className={mini ? 'size-16' : 'size-40'}
          showValue={false}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
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
      aria-label={`${meter.name}: ${Math.round(meter.current_value)}% ready`}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-xl p-2 transition-colors duration-200',
        'hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]',
        selected && 'bg-surface-raised ring-2 ring-brand',
      )}
    >
      {body}
    </button>
  );
}
