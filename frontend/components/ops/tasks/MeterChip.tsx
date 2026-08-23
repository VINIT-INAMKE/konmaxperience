'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { optionalGet } from '@/lib/api/optional';
import { readinessHref } from '@/lib/nav/meters';
import type { ReadinessMeter } from '@/lib/types/readiness';
import { cn } from '@/lib/utils';

export interface MeterChipProps {
  meterId?: string | null;
  meterCode?: string | null;
  meterLabel?: string | null;
  /** `Task.readiness_value` — the points this task adds when it validates. */
  value?: number | null;
  /** See `QuestTaskChip`: `false` inside a card that is itself one big link. */
  linkify?: boolean;
  className?: string;
}

/**
 * `GET /tasks` selects `readiness_meter: { id, name }` and no `code`, but the
 * deep link is by code. One cached directory read resolves every chip on the
 * page — never one request per row — and it is optional, so a role that cannot
 * read `/readiness-meters` simply gets an unlinked chip.
 */
const METER_DIRECTORY_KEY = ['readiness-meters', 'directory'] as const;

/**
 * SPEC §6.4 — "and the meter it feeds". A task that moves no meter renders no
 * chip; an empty gauge would read as "this contributes nothing" rather than
 * "this is not a readiness task".
 */
export function MeterChip({
  meterId,
  meterCode,
  meterLabel,
  value,
  linkify = true,
  className,
}: MeterChipProps) {
  const needsDirectory = Boolean(meterId) && !meterCode;

  const { data: directory } = useQuery({
    queryKey: METER_DIRECTORY_KEY,
    queryFn: () => optionalGet<ReadinessMeter[]>('/readiness-meters'),
    enabled: needsDirectory,
    staleTime: 5 * 60_000,
  });

  if (!meterId && !meterCode) return null;

  const resolved = meterId
    ? directory?.find((meter) => meter.id === meterId)
    : directory?.find((meter) => meter.code === meterCode);

  const label = meterLabel ?? resolved?.name ?? null;
  const code = meterCode ?? resolved?.code ?? null;

  // The meter exists but nothing on this page can name it — a nameless gauge
  // is noise, so the chip stands down until the directory resolves.
  if (!label) return null;

  const points = typeof value === 'number' && value > 0 ? value : null;

  const content = (
    <>
      <Gauge className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      {points !== null && (
        <span className="shrink-0 font-medium tabular-nums">+{points}</span>
      )}
    </>
  );

  const classes = cn(
    'max-w-full gap-1 border-info-status/30 bg-info-status/10 px-1.5 text-[11px] font-normal text-info-status',
    className,
  );

  const title = points !== null ? `${label} · +${points}` : label;

  if (!linkify || !code) {
    return (
      <Badge variant="outline" className={classes} title={title}>
        {content}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      // `[a]:` mirrors the `outline` variant's own anchor-hover selector so
      // tailwind-merge replaces it rather than losing to its specificity.
      className={cn(
        classes,
        '[a]:hover:bg-info-status/20 [a]:hover:text-info-status focus-visible:ring-[var(--focus)]/50',
      )}
      title={title}
      render={<Link href={readinessHref(code)} />}
    >
      {content}
    </Badge>
  );
}
