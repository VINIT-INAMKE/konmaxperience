'use client';

import { cn } from '@/lib/utils';
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { NumberTicker } from '@/components/ui/number-ticker';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { getMeterColors } from '@/lib/types/gamification';
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
  const colors = getMeterColors(meter.current_value);

  return (
    <div
      className={cn(
        'group flex flex-col items-center gap-2 cursor-pointer hover:scale-105 transition-transform duration-200',
        selected && 'ring-2 ring-primary rounded-xl p-1',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${meter.name}: ${Math.round(meter.current_value)}% ready`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="relative">
        <AnimatedCircularProgressBar
          value={meter.current_value}
          gaugePrimaryColor={colors.primary}
          gaugeSecondaryColor={colors.secondary}
          className={mini ? 'size-16' : 'size-40'}
          showValue={false}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={cn('font-semibold', colors.textClass, mini ? 'text-xs' : 'text-lg')}>
            <NumberTicker
              value={meter.current_value}
              className={cn('font-semibold', colors.textClass)}
            />
            %
          </span>
        </div>
        {!mini && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
            <InteractiveHoverButton className="text-xs px-3 py-1">
              View Tasks
            </InteractiveHoverButton>
          </div>
        )}
      </div>
      <span className="text-sm text-muted-foreground text-center max-w-[120px] leading-tight">
        {meter.name}
      </span>
    </div>
  );
}
