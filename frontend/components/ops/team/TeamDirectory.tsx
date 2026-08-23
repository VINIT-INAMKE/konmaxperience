'use client';

/**
 * Who is on the team and what they carry.
 *
 * `GET /users` is gated on `VIEW_ALL`, so `TeamTabs` only offers this tab to
 * roles that hold it — the other seven see the Wins / Contribution / Activity /
 * Leaderboard set, which is the roster SPEC §6.2 item 8 actually names. The
 * 403 branch is still handled here: permissions can change under a live session.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Users } from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, ApiError } from '@/lib/api-client';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { UserProfile } from '@/lib/types/users';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function roleNameOf(user: UserProfile) {
  return user.role?.name ?? user.roleName ?? 'Unassigned';
}

export function TeamDirectory() {
  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ['users', 'directory'],
    queryFn: () => apiClient.get<UserProfile[]>('/users'),
  });

  /** Grouped by role so the directory reads as an org chart, not a flat list. */
  const groups = useMemo(() => {
    const byRole = new Map<string, UserProfile[]>();
    for (const user of data ?? []) {
      const key = roleNameOf(user);
      const bucket = byRole.get(key);
      if (bucket) bucket.push(user);
      else byRole.set(key, [user]);
    }
    return [...byRole.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([roleName, members]) => ({
        roleName,
        members: [...members].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <Alert variant={forbidden ? 'default' : 'destructive'}>
        <AlertCircle className="size-4" />
        <AlertTitle>
          {forbidden ? 'Directory not available' : 'Could not load the team'}
        </AlertTitle>
        <AlertDescription>
          {forbidden
            ? 'Your role cannot see the full user list. The other tabs still work.'
            : 'The team roster did not come back. Try again in a moment.'}
        </AlertDescription>
        {!forbidden && (
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertAction>
        )}
      </Alert>
    );
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <Users className="size-10 text-ink-faint" />
          <p className="text-sm text-ink-muted">Nobody is on the team yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(({ roleName, members }) => (
        <section key={roleName} className="space-y-2">
          <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {roleName}
            <span className="ml-2 font-normal tabular-nums normal-case">
              {members.length}
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {member.name}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      Lv {member.level}
                    </Badge>
                    {member.status !== 'active' && (
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${STATUS_BADGE.neutral}`}
                      >
                        Inactive
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
