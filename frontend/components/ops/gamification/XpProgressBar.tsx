'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { NumberTicker } from '@/components/ui/number-ticker';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { getXpForNextLevel } from '@/lib/types/gamification';

interface XpProgressBarProps {
  xpTotal: number;
  level: number;
  className?: string;
}

export function XpProgressBar({ xpTotal, level, className }: XpProgressBarProps) {
  const { current, target, percent } = getXpForNextLevel(xpTotal);
  const prevXpRef = useRef(xpTotal);

  const startValue = prevXpRef.current !== xpTotal ? prevXpRef.current : 0;

  return (
    <div className={cn('space-y-1', className)}>
      <Progress value={percent} className="flex-col gap-1">
        <ProgressLabel className="text-xs text-muted-foreground">
          Level {level} — {current}/{target} XP to next
        </ProgressLabel>
        <ProgressValue className="text-xs" />
      </Progress>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <NumberTicker
          value={xpTotal}
          startValue={startValue}
          className="text-xs tabular-nums text-foreground"
        />
        <span>XP total</span>
      </div>
    </div>
  );
}
