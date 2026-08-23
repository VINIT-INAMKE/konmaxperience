'use client';

import { LevelBadge } from '@/components/ops/gamification/LevelBadge';
import type { LeaderboardUser } from '@/lib/types/leaderboard';

interface LeaderboardPodiumProps {
  users: LeaderboardUser[];
  currentUserId: string;
}

interface PodiumColumnProps {
  user: LeaderboardUser;
  rank: number;
  isCurrentUser: boolean;
  elevated: boolean;
}

function PodiumColumn({ user, rank, isCurrentUser, elevated }: PodiumColumnProps) {
  return (
    <div
      className={`flex flex-col items-center gap-2 p-4 rounded-xl ${
        isCurrentUser ? 'ring-2 ring-inset ring-brand bg-brand-soft' : ''
      }`}
      style={elevated ? { transform: 'translateY(-20px)' } : undefined}
    >
      <img
        src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
        alt={user.name}
        className="size-12 rounded-full border-2 border-line"
        width={48}
        height={48}
      />
      <span className="text-base font-semibold">{user.name}</span>
      <LevelBadge level={user.level} />
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold tabular-nums">
          {user.xp_total.toLocaleString('en-IN')}
        </span>
        <span className="text-xs text-ink-muted">XP</span>
      </div>
      <span className="text-2xl font-semibold text-brand">#{rank}</span>
    </div>
  );
}

export function LeaderboardPodium({ users, currentUserId }: LeaderboardPodiumProps) {
  const top3 = users.slice(0, 3);

  // Podium order: 2nd, 1st, 3rd (center = 1st place, elevated)
  const podiumOrder = [
    top3[1] ? { user: top3[1], rank: 2, elevated: false } : null,
    top3[0] ? { user: top3[0], rank: 1, elevated: true } : null,
    top3[2] ? { user: top3[2], rank: 3, elevated: false } : null,
  ].filter(Boolean) as { user: LeaderboardUser; rank: number; elevated: boolean }[];

  return (
    <div className="flex items-end justify-center gap-4 py-6">
      {podiumOrder.map(({ user, rank, elevated }) => (
        <PodiumColumn
          key={user.id}
          user={user}
          rank={rank}
          isCurrentUser={user.id === currentUserId}
          elevated={elevated}
        />
      ))}
    </div>
  );
}
