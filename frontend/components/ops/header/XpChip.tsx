'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NumberTicker } from '@/components/ui/number-ticker';
import { LevelBadge } from '@/components/ops/gamification/LevelBadge';
import { XpProgressBar } from '@/components/ops/gamification/XpProgressBar';

/**
 * SPEC §6.1 slot 6 — XP total and level, lifted out of the old sidebar's bottom
 * block so the spine carries navigation only.
 *
 * The panel is a `Popover`, not a `DropdownMenu`: its content is a progress bar,
 * not a list of commands, and `role="menu"` around non-menuitem content is an
 * a11y lie. `NumberTicker` is on the SPEC §6.4 motion allowlist for the header.
 */
export function XpChip({ xpTotal, level }: { xpTotal: number; level: number }) {
  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-raised px-2 text-xs transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
        aria-label={`${xpTotal} XP, level ${level} — open progress`}
      >
        <NumberTicker
          value={xpTotal}
          className="text-xs font-semibold tracking-normal text-ink"
        />
        <span className="text-ink-muted" aria-hidden="true">
          XP
        </span>
        <LevelBadge level={level} className="h-5" />
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-64">
        <XpProgressBar xpTotal={xpTotal} level={level} />
      </PopoverContent>
    </Popover>
  );
}
