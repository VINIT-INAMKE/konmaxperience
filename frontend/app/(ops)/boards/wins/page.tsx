'use client';

/**
 * Decision 11 — this route stays reachable but leaves the spine; `/team?tab=wins`
 * is where it is now surfaced. Both render `WinsPanel`, so there is one
 * implementation, not two that drift.
 */

import { WinsPanel } from '@/components/ops/team/WinsPanel';

export default function WinsBoardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wins &amp; Milestones</h1>
      <WinsPanel />
    </div>
  );
}
