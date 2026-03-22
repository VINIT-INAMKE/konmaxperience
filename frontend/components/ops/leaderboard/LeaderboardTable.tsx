'use client';

import { MagicCard } from '@/components/ui/magic-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NumberTicker } from '@/components/ui/number-ticker';
import { LevelBadge } from '@/components/ops/gamification/LevelBadge';
import { cn } from '@/lib/utils';
import type { LeaderboardUser } from '@/lib/types/leaderboard';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

interface LeaderboardTableProps {
  users: LeaderboardUser[];
  currentUserId: string;
  startRank: number;
}

export function LeaderboardTable({
  users,
  currentUserId,
  startRank,
}: LeaderboardTableProps) {
  if (users.length === 0) return null;

  const tableContent = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th scope="col" className="px-4 py-3 text-muted-foreground font-medium w-16">
            Rank
          </th>
          <th scope="col" className="px-4 py-3 text-muted-foreground font-medium">
            User
          </th>
          <th scope="col" className="px-4 py-3 text-muted-foreground font-medium w-24">
            Level
          </th>
          <th scope="col" className="px-4 py-3 text-muted-foreground font-medium w-28">
            XP
          </th>
        </tr>
      </thead>
      <tbody>
        {users.map((user, index) => {
          const rank = startRank + index;
          const isCurrentUser = user.id === currentUserId;

          return (
            <tr
              key={user.id}
              className={cn(
                'border-b last:border-0 transition-colors',
                isCurrentUser && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
              )}
            >
              <td className="px-4 py-3 text-muted-foreground font-medium">
                #{rank}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                    alt={user.name}
                    className="size-8 rounded-full border border-border"
                    width={32}
                    height={32}
                  />
                  <span className={cn('font-medium', isCurrentUser && 'text-primary')}>
                    {user.name}
                    {isCurrentUser && <span className="text-xs text-muted-foreground ml-1.5">(you)</span>}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <LevelBadge level={user.level} />
              </td>
              <td className="px-4 py-3 tabular-nums font-medium">
                <NumberTicker
                  value={user.xp_total}
                  className="text-sm tabular-nums"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <MagicCard gradientColor={GRADIENT_OVERLAY} className="overflow-hidden rounded-xl">
      {users.length > 10 ? (
        <ScrollArea className="max-h-96">{tableContent}</ScrollArea>
      ) : (
        tableContent
      )}
    </MagicCard>
  );
}
