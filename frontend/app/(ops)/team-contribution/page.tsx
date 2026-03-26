'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
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
import type { TeamContributionRow } from '@/lib/types/activity';

type Scope = 'week' | 'month' | 'mission';

export default function TeamContributionPage() {
  const [scope, setScope] = useState<Scope>('mission');

  const { data, isLoading } = useQuery({
    queryKey: ['team-contributions', scope],
    queryFn: () => apiClient.get<TeamContributionRow[]>(`/activity/contributions?scope=${scope}`),
  });

  return (
    <BlurFade>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
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
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <Users className="size-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No contributions recorded yet for this period.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.map((row) => (
              <Card key={row.roleCode}>
                <CardContent className="py-4 px-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold">{row.roleName}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{row.tasksCompleted} tasks completed</span>
                        <span>{row.tasksValidated} validated</span>
                        {row.blockedCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1">
                            {row.blockedCount} blocked
                          </Badge>
                        )}
                      </div>
                    </div>
                    {row.readinessDelta.length > 0 && (
                      <div className="text-right space-y-1">
                        {row.readinessDelta.map((d) => (
                          <div key={d.meterName} className="flex items-center gap-1 text-xs text-blue-500">
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
    </BlurFade>
  );
}
