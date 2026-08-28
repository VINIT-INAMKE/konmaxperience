'use client';

/**
 * RUN-02 — `/operations/daily-close`.
 *
 * A thin route around `<DailyCloseScreen />`, matching every other page under
 * `app/(ops)/operations/**`: the shell, the header and the auth bootstrap all
 * live in `app/(ops)/layout.tsx`, so a page adds a title and its screen.
 *
 * **No client-side permission gate.** All four `/daily-close` routes carry
 * `@RequiresPermission(MANAGE_OPS)`, and sign-off carries a second gate against
 * `daily_close.signer_role_codes` inside the service. A viewer without the
 * permission gets a `403` on the first read, which the screen renders as a
 * plain refusal — the server's answer, not a guess assembled from a cached
 * permission list.
 */

import { DailyCloseScreen } from '@/components/ops/daily-close/DailyCloseScreen';

export default function DailyClosePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Daily Close</h1>
        <p className="text-sm text-muted-foreground">
          One signed record per business day. The numbers are frozen when they
          are computed and frozen for good when they are signed — nothing on this
          screen is recalculated as you read it.
        </p>
      </div>

      <DailyCloseScreen />
    </div>
  );
}
