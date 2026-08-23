'use client';

import Link from 'next/link';
import { Gauge } from 'lucide-react';
import { NumberTicker } from '@/components/ui/number-ticker';
import { readinessBandToken } from '@/lib/status-styles';

/**
 * SPEC §6.1 slot 4 — node readiness %.
 *
 * The band colour comes from `readinessBandToken`, the same ramp `/readiness`
 * and the meter rings use, so the number and its colour never disagree across
 * screens. `null` (no meters configured yet) renders an em dash and **no**
 * colour — an uncoloured dash reads as "not measured", a green 0 % would lie.
 */
export function ReadinessPill({ value }: { value: number | null }) {
  const measured = value !== null;
  const band = measured ? readinessBandToken(value) : 'var(--ink-faint)';

  return (
    <Link
      href="/readiness"
      aria-label={
        measured
          ? `Node readiness ${value} percent`
          : 'Node readiness not measured yet'
      }
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-raised px-2.5 text-xs font-medium text-ink transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
    >
      <Gauge className="size-3.5 shrink-0" style={{ color: band }} aria-hidden="true" />
      {measured ? (
        <span className="flex items-baseline gap-px tabular-nums" style={{ color: band }}>
          <NumberTicker
            value={value}
            className="text-xs font-semibold tracking-normal"
            style={{ color: band }}
          />
          <span aria-hidden="true">%</span>
        </span>
      ) : (
        <span className="text-ink-muted" aria-hidden="true">
          —
        </span>
      )}
      <span className="text-ink-muted">ready</span>
    </Link>
  );
}
