'use client';

import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LevelBadge } from '@/components/ops/gamification/LevelBadge';
import { cn } from '@/lib/utils';
import type { LeaderboardUser } from '@/lib/types/leaderboard';

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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="px-4 py-3 text-ink-muted font-medium w-16">
              Rank
            </th>
            <th scope="col" className="px-4 py-3 text-ink-muted font-medium">
              User
            </th>
            <th scope="col" className="px-4 py-3 text-ink-muted font-medium w-24">
              Level
            </th>
            <th scope="col" className="px-4 py-3 text-ink-muted font-medium w-28">
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
                  'border-b last:border-0 transition-colors motion-reduce:transition-none',
                  isCurrentUser && 'bg-brand-soft ring-1 ring-inset ring-brand/25',
                )}
              >
                <td className="px-4 py-3 text-ink-muted font-medium">
                  #{rank}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                      alt={user.name}
                      className="size-8 rounded-full border border-line"
                      width={32}
                      height={32}
                    />
                    <span className={cn('font-medium', isCurrentUser && 'text-brand')}>
                      {user.name}
                      {isCurrentUser && <span className="text-xs text-ink-muted ml-1.5">(you)</span>}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <LevelBadge level={user.level} />
                </td>
                <td className="px-4 py-3 tabular-nums font-medium">
                  {user.xp_total.toLocaleString('en-IN')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <Card className="overflow-hidden rounded-xl py-0">
      {users.length > 10 ? (
        <ScrollArea className="max-h-96">{tableContent}</ScrollArea>
      ) : (
        tableContent
      )}
    </Card>
  );
}
