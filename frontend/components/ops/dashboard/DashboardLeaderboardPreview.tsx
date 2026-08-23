'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Button } from '@/components/ui/button';
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
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Trophy className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No rankings yet. Complete and validate tasks to earn XP and appear on the leaderboard.
          </p>
          <Button nativeButton={false} render={<Link href="/tasks" />} variant="outline" size="sm">
            Go to tasks
          </Button>
        </div>
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
              className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            >
              View Leaderboard
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
