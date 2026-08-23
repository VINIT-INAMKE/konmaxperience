'use client';

/**
 * Decision 11 — this route stays reachable but leaves the spine; `/team?tab=leaderboard`
 * is where it is now surfaced. Both render `LeaderboardPanel`, so there is one
 * implementation, not two that drift.
 */

import { LeaderboardPanel } from '@/components/ops/team/LeaderboardPanel';
import { ExportButton } from '@/components/ops/exports/ExportButton';

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Team Leaderboard</h1>
        <ExportButton
          reportType="leaderboard"
          reportName="Leaderboard"
          isTimeSeries={false}
        />
      </div>
      <LeaderboardPanel />
    </div>
  );
}
