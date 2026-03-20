'use client';

import { BlurFade } from '@/components/ui/blur-fade';
import { ShineBorder } from '@/components/ui/shine-border';
import { HyperText } from '@/components/ui/hyper-text';
import { NumberTicker } from '@/components/ui/number-ticker';
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
  const content = (
    <div
      className="flex flex-col items-center gap-2 p-4 rounded-xl"
      style={elevated ? { transform: 'translateY(-20px)' } : undefined}
    >
      <img
        src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
        alt={user.name}
        className="size-12 rounded-full border-2 border-border"
        width={48}
        height={48}
      />
      <HyperText
        as="span"
        className="text-base font-semibold py-0 overflow-visible"
        animateOnHover
        startOnView
      >
        {user.name}
      </HyperText>
      <LevelBadge level={user.level} />
      <div className="flex items-baseline gap-1">
        <NumberTicker
          value={user.xp_total}
          className="text-lg font-bold tabular-nums"
        />
        <span className="text-xs text-muted-foreground">XP</span>
      </div>
      <span className="text-2xl font-semibold" style={{ color: 'var(--primary)' }}>
        #{rank}
      </span>
    </div>
  );

  if (isCurrentUser) {
    return (
      <div className="relative rounded-xl">
        <ShineBorder borderWidth={2} shineColor={['#a78bfa', '#22c55e']} />
        {content}
      </div>
    );
  }

  return content;
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
    <BlurFade>
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
    </BlurFade>
  );
}
