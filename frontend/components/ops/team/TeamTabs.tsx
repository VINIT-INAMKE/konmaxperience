'use client';

/**
 * SPEC §6.2 item 8 — the Team hub. Decision 11: `/boards/wins`,
 * `/team-contribution`, `/activity` and `/leaderboard` stay reachable as routes
 * but leave the spine and are absorbed here as tabs, which is what makes "no
 * label appears twice" hold.
 *
 * The active tab lives in `?tab=`, so a tab is linkable and the back button
 * moves between tabs. Only the active panel's component is mounted, so opening
 * the hub costs one request, not five.
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Activity, Trophy, TrendingUp, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Permission } from '@/lib/types/permissions';
import { ActivityFeedList } from './ActivityFeedList';
import { ContributionTable } from './ContributionTable';
import { LeaderboardPanel, useLeaderboard } from './LeaderboardPanel';
import { TeamDirectory } from './TeamDirectory';
import { WinsPanel } from './WinsPanel';

type TeamTab = 'wins' | 'contribution' | 'activity' | 'leaderboard' | 'directory';

const DEFAULT_TAB: TeamTab = 'wins';

const TAB_LABELS: Record<TeamTab, string> = {
  wins: 'Wins',
  contribution: 'Contribution',
  activity: 'Activity',
  leaderboard: 'Leaderboard',
  directory: 'Directory',
};

const TAB_ICONS: Record<TeamTab, typeof Trophy> = {
  wins: Trophy,
  contribution: TrendingUp,
  activity: Activity,
  leaderboard: Trophy,
  directory: Users,
};

export function TeamTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const permissions = useAuthStore((s) => s.permissions);

  // `GET /users` is `VIEW_ALL`-gated, so the tab only exists for roles that hold it.
  const canSeeDirectory = permissions.includes(Permission.VIEW_ALL);

  /*
    The leaderboard's kill switch is `enabled` on the response the panel already
    needs, so the check shares the `['leaderboard']` cache entry rather than
    costing a second request. While it is in flight the tab is offered — hiding
    it on every first paint would make the hub jump.
  */
  const { data: leaderboard } = useLeaderboard();
  const leaderboardEnabled = leaderboard?.enabled !== false;

  const available: TeamTab[] = [
    'wins',
    'contribution',
    'activity',
    ...(leaderboardEnabled ? (['leaderboard'] as TeamTab[]) : []),
    ...(canSeeDirectory ? (['directory'] as TeamTab[]) : []),
  ];

  const requested = params.get('tab') as TeamTab | null;
  // An unknown tab — or `?tab=leaderboard` while the switch is off — falls back.
  const tab =
    requested && available.includes(requested) ? requested : DEFAULT_TAB;

  const setTab = (next: string) => {
    const query = new URLSearchParams(params.toString());
    query.set('tab', next);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={(value: unknown) => setTab(String(value))}>
      {/* Rule S8: the tab strip scrolls inside itself, the page never does. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList>
          {available.map((value) => {
            const Icon = TAB_ICONS[value];
            return (
              <TabsTrigger key={value} value={value}>
                <Icon className="size-4" />
                {TAB_LABELS[value]}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <TabsContent value="wins" className="pt-2">
        {tab === 'wins' && <WinsPanel />}
      </TabsContent>
      <TabsContent value="contribution" className="pt-2">
        {tab === 'contribution' && <ContributionTable />}
      </TabsContent>
      <TabsContent value="activity" className="pt-2">
        {tab === 'activity' && <ActivityFeedList />}
      </TabsContent>
      {leaderboardEnabled && (
        <TabsContent value="leaderboard" className="pt-2">
          {tab === 'leaderboard' && <LeaderboardPanel />}
        </TabsContent>
      )}
      {canSeeDirectory && (
        <TabsContent value="directory" className="pt-2">
          {tab === 'directory' && <TeamDirectory />}
        </TabsContent>
      )}
    </Tabs>
  );
}
