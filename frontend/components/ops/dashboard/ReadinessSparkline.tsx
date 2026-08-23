'use client';

import { useQuery } from '@tanstack/react-query';
import { optionalGet } from '@/lib/api/optional';
import { P31 } from '@/lib/api/phase31';
import { readinessBandToken } from '@/lib/status-styles';
import { cn } from '@/lib/utils';
import type { MeterHistoryResponse } from '@/lib/types/readiness';

/** The drawing box. `preserveAspectRatio="none"` stretches it to the slot. */
const VIEW_W = 100;
const VIEW_H = 24;
/** Half a stroke of head-room top and bottom so 0 and 100 are not clipped. */
const PAD = 2;

interface ReadinessSparklineProps {
  /** `ReadinessMeter.code` — the history route is keyed by code, not id. */
  code: string;
  days?: number;
  className?: string;
}

/**
 * SPEC §6.5 — the 30-day trail behind a readiness meter, drawn as a bare SVG
 * polyline. No chart library: recharts is ~40 KB to draw thirty points that
 * carry no axis, no tooltip and no legend. The meter's numeric value sits beside
 * it and carries the meaning, so the line is `aria-hidden`.
 *
 * The Y domain is pinned to 0–100 rather than fitted to the data, so a stable
 * meter reads as a flat line instead of amplified noise.
 *
 * Degrades to nothing at all when the history route is absent or returns fewer
 * than two points — the ring next to it already shows the current value.
 */
export function ReadinessSparkline({
  code,
  days = 30,
  className,
}: ReadinessSparklineProps) {
  const { data } = useQuery({
    queryKey: ['readiness-history', code, days],
    queryFn: () =>
      optionalGet<MeterHistoryResponse>(P31.readinessHistory(code, days)),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const points = data?.points ?? [];
  if (points.length < 2) return null;

  const span = points.length - 1;
  const path = points
    .map((point, index) => {
      const x = (index / span) * VIEW_W;
      const clamped = Math.max(0, Math.min(100, point.value));
      const y = PAD + (1 - clamped / 100) * (VIEW_H - PAD * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const latest = points[points.length - 1].value;
  const first = points[0].value;
  const delta = Math.round(latest - first);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-6 min-w-0 flex-1"
        aria-hidden="true"
        focusable="false"
      >
        <polyline
          points={path}
          fill="none"
          stroke={readinessBandToken(latest)}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
        {delta > 0 ? `+${delta}` : delta}
        <span className="sr-only"> points over the last {days} days</span>
      </span>
    </div>
  );
}
