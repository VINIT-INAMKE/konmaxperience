'use client';

import Link from 'next/link';
import { ReadinessMeterRing } from '@/components/ops/readiness/ReadinessMeterRing';
import type { ReadinessMeter } from '@/lib/types/readiness';

interface DashboardReadinessStripProps {
  meters: ReadinessMeter[];
}

export function DashboardReadinessStrip({ meters }: DashboardReadinessStripProps) {
  // Sort by current_value ASC, take the 5 lowest (most attention needed)
  const lowestMeters = [...meters]
    .sort((a, b) => a.current_value - b.current_value)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Attention Needed</span>
        <Link
          href="/readiness"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View All
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {lowestMeters.map((meter) => (
          <div key={meter.id} className="shrink-0">
            <ReadinessMeterRing meter={meter} mini={true} />
          </div>
        ))}
      </div>
    </div>
  );
}
