'use client';

import Link from 'next/link';
import { NumberTicker } from '@/components/ui/number-ticker';
import type { LeaderboardResponse } from '@/lib/types/leaderboard';

interface DashboardLeaderboardPreviewProps {
  data: LeaderboardResponse;
}

export function DashboardLeaderboardPreview({ data }: DashboardLeaderboardPreviewProps) {
  // If kill switch is off, return null — section entirely hidden (no text per copywriting)
  if (data.enabled === false) {
    return null;
  }

  const top5 = data.users.slice(0, 5);

  return (
    <div className="space-y-3">
      <span className="text-sm font-semibold">Leaderboard</span>

      {top5.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rankings yet. Complete and validate tasks to earn XP and appear on the leaderboard.
        </p>
      ) : (
        <>
          <ol className="space-y-2">
            {top5.map((user, index) => (
              <li key={user.id} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground w-5 text-right shrink-0">
                  #{index + 1}
                </span>
                <span className="flex-1 font-medium truncate">{user.name}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  <NumberTicker
                    value={user.xp_total}
                    className="text-sm tabular-nums"
                  />{' '}
                  XP
                </span>
              </li>
            ))}
          </ol>

          <div className="flex justify-end">
            <Link
              href="/leaderboard"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View Leaderboard
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
