'use client';

/**
 * Decision 11 — this route stays reachable but leaves the spine; `/team?tab=activity`
 * is where it is now surfaced. Both render `ActivityFeedList`, so there is one
 * implementation, not two that drift.
 */

import { ActivityFeedList } from '@/components/ops/team/ActivityFeedList';

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Activity Feed</h1>
      <ActivityFeedList />
    </div>
  );
}
