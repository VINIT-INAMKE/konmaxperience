'use client';

/**
 * Per-role contribution for a scope, extracted from `app/(ops)/team-contribution`
 * so the `/team` hub's Contribution tab and the standalone route render the same
 * thing from one place (SPEC §6.2 item 8 / Decision 11).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, TrendingUp, Users } from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { TeamContributionRow } from '@/lib/types/activity';

export type ContributionScope = 'week' | 'month' | 'mission';

interface ContributionTableProps {
  /** Scope the picker starts on. */
  defaultScope?: ContributionScope;
}

export function ContributionTable({
  defaultScope = 'mission',
}: ContributionTableProps) {
  const [scope, setScope] = useState<ContributionScope>(defaultScope);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['team-contributions', scope],
    queryFn: () =>
      apiClient.get<TeamContributionRow[]>(
        `/activity/contributions?scope=${scope}`,
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Select
          value={scope}
          onValueChange={(value) =>
            setScope((value ?? 'mission') as ContributionScope)
          }
        >
          <SelectTrigger
            className="h-8 w-36"
            size="sm"
            aria-label="Contribution period"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="mission">This Mission</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load contributions</AlertTitle>
          <AlertDescription>
            Team contribution figures did not come back. Try again in a moment.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Users className="size-10 text-ink-faint" />
            <p className="text-sm text-ink-muted">
              No contributions recorded yet for this period.
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/boards/quests" />}
            >
              Go to the quest board
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((row) => (
            <Card key={row.roleCode}>
              <CardContent className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold">{row.roleName}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                      <span>{row.tasksCompleted} tasks completed</span>
                      <span>{row.tasksValidated} validated</span>
                      {row.blockedCount > 0 && (
                        <Badge
                          variant="secondary"
                          className={`h-4 px-1 text-[10px] ${STATUS_BADGE.critical}`}
                        >
                          {row.blockedCount} blocked
                        </Badge>
                      )}
                    </div>
                  </div>
                  {row.readinessDelta.length > 0 && (
                    <div className="space-y-1 text-right">
                      {row.readinessDelta.map((delta) => (
                        <div
                          key={delta.meterName}
                          className="flex items-center gap-1 text-xs text-[var(--status-good)]"
                        >
                          <TrendingUp className="size-2.5" />+{delta.value}{' '}
                          {delta.meterName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
