'use client';

import Link from 'next/link';
import { TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { ReadinessMeterRing } from '@/components/ops/readiness/ReadinessMeterRing';
import type { ReadinessMeter } from '@/lib/types/readiness';

interface DashboardReadinessStripProps {
  meters: ReadinessMeter[];
}

function getMeterInsight(meter: ReadinessMeter): string {
  const val = Math.round(meter.current_value);
  if (val < 30) return 'Needs urgent attention';
  if (val < 50) return 'Falling behind';
  if (val < 70) return 'Room to improve';
  return 'On track';
}

export function DashboardReadinessStrip({ meters }: DashboardReadinessStripProps) {
  // Sort by current_value ASC, take the 5 lowest (most attention needed)
  const lowestMeters = [...meters]
    .sort((a, b) => a.current_value - b.current_value)
    .slice(0, 5);

  if (lowestMeters.length === 0) return null;

  const criticalCount = lowestMeters.filter((m) => m.current_value < 50).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-sm font-semibold">System Readiness</span>
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-500 font-normal">
              <TrendingDown className="size-3" />
              {criticalCount} below 50%
            </span>
          )}
        </CardTitle>
        <CardAction>
          <Link
            href="/readiness"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 overflow-x-auto pb-2">
          {lowestMeters.map((meter) => (
            <div key={meter.id} className="shrink-0 flex flex-col items-center gap-1">
              <ReadinessMeterRing meter={meter} mini={true} />
              <span className="text-[10px] text-muted-foreground">
                {getMeterInsight(meter)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
