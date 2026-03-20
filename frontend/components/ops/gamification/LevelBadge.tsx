'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BorderBeam } from '@/components/ui/border-beam';
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
          'inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold text-white',
          colors.bg,
          className,
        )}
      >
        Lvl {level}
      </span>
      {glowActive && (
        <span className="pointer-events-none absolute inset-0 rounded-full overflow-hidden">
          <BorderBeam duration={3} colorFrom={colors.hex} colorTo="#ffffff" />
        </span>
      )}
    </span>
  );
}
