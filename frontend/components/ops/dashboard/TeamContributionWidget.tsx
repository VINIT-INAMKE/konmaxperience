'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import type { TeamContributionRow } from '@/lib/types/activity';

type Scope = 'week' | 'month' | 'mission';

export function TeamContributionWidget() {
  const [scope, setScope] = useState<Scope>('mission');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-contributions', scope],
    queryFn: () => apiClient.get<TeamContributionRow[]>(`/activity/contributions?scope=${scope}`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold">Team Contribution</CardTitle>
        <CardAction>
          <Select value={scope} onValueChange={(val) => setScope((val ?? 'mission') as Scope)}>
            <SelectTrigger className="h-6 w-28 text-xs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="mission">This Mission</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Could not load Team Contribution. Refresh to try again.</p>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Users className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No contributions recorded yet for this period.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {data.map((row) => (
              <div
                key={row.roleCode}
                className="flex items-center gap-3 text-sm px-2 py-1.5 rounded-md hover:bg-muted"
              >
                <span className="w-32 truncate font-medium">{row.roleName}</span>
                <span className="text-xs text-muted-foreground">{row.tasksCompleted} done</span>
                <span className="text-xs text-muted-foreground">{row.tasksValidated} valid</span>
                {row.blockedCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1">
                    {row.blockedCount} blocked
                  </Badge>
                )}
                {row.readinessDelta.length > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-blue-500 ml-auto">
                    <TrendingUp className="size-2.5" />
                    +{row.readinessDelta.reduce((s, d) => s + d.value, 0)}
                  </span>
                )}
              </div>
            ))}
            <div className="pt-2 text-right">
              <Link href="/team-contribution" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View details
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
