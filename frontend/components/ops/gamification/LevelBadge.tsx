'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { LEVEL_COLORS } from '@/lib/types/gamification';

interface LevelBadgeProps {
  level: number;
  showGlow?: boolean;
  className?: string;
}

export function LevelBadge({ level, showGlow = false, className }: LevelBadgeProps) {
  const [glowActive, setGlowActive] = useState(showGlow);

  useEffect(() => {
    if (showGlow) {
      setGlowActive(true);
      const timer = setTimeout(() => setGlowActive(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showGlow]);

  const colors = LEVEL_COLORS[level] ?? LEVEL_COLORS[1];

  return (
    <span className="relative inline-flex items-center">
      <span
        aria-label={`Level ${level}`}
        className={cn(
          'inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
          colors.fill,
          // SPEC §6.4 — the level-up moment is a 3-second ring, not a BorderBeam.
          glowActive &&
            'ring-2 ring-brand ring-offset-2 ring-offset-[var(--bg)] animate-pulse motion-reduce:animate-none',
          className,
        )}
      >
        Lvl {level}
      </span>
    </span>
  );
}
