'use client';

/**
 * SPEC §6.2 item 8 — the Team hub.
 *
 * Decision 3: `/team` is also the staff login URL for anyone without a valid
 * cookie — `frontend/proxy.ts` *rewrites* that case to `/sign-in`, so this page
 * only ever renders for authenticated staff and the frozen homepage's three
 * `/team` links keep working.
 */

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamTabs } from '@/components/ops/team/TeamTabs';

export default function TeamPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Team</h1>
      {/* `useSearchParams()` needs a Suspense boundary above it to prerender. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <TeamTabs />
      </Suspense>
    </div>
  );
}
