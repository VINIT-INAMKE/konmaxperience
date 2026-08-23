'use client';

/**
 * Decision 11 — this route stays reachable but leaves the spine; `/team?tab=contribution`
 * is where it is now surfaced. Both render `ContributionTable`, so there is one
 * implementation, not two that drift.
 */

import { ContributionTable } from '@/components/ops/team/ContributionTable';

export default function TeamContributionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Team Contribution</h1>
      <ContributionTable />
    </div>
  );
}
