'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, TrendingUp, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

type Scope = 'week' | 'month' | 'mission';

export default function TeamContributionPage() {
  const [scope, setScope] = useState<Scope>('mission');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['team-contributions', scope],
    queryFn: () => apiClient.get<TeamContributionRow[]>(`/activity/contributions?scope=${scope}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Team Contribution</h1>
        <Select value={scope} onValueChange={(val) => setScope((val ?? 'mission') as Scope)}>
          <SelectTrigger className="h-8 w-36" size="sm">
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
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-muted animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Couldn&apos;t load team contributions. Try again in a moment.
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Users className="size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
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
              <CardContent className="py-4 px-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold">{row.roleName}</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{row.tasksCompleted} tasks completed</span>
                      <span>{row.tasksValidated} validated</span>
                      {row.blockedCount > 0 && (
                        <Badge
                          variant="secondary"
                          className={`text-[10px] h-4 px-1 ${STATUS_BADGE.critical}`}
                        >
                          {row.blockedCount} blocked
                        </Badge>
                      )}
                    </div>
                  </div>
                  {row.readinessDelta.length > 0 && (
                    <div className="text-right space-y-1">
                      {row.readinessDelta.map((d) => (
                        <div
                          key={d.meterName}
                          className="flex items-center gap-1 text-xs text-[var(--status-good)]"
                        >
                          <TrendingUp className="size-2.5" />
                          +{d.value} {d.meterName}
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
