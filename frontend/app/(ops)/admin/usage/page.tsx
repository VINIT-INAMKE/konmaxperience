'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ManageSystemGate } from '@/components/ops/admin/ManageSystemGate';
import { UsageDashboard } from '@/components/ops/admin/usage/UsageDashboard';

/**
 * RUN-04 — "who is actually using this thing".
 *
 * `GET /usage/summary` carries `@RequiresPermission(MANAGE_SYSTEM)`, so the same
 * gate `/admin/modules` and `/admin/node` use wraps the body: without it a role
 * that cannot read the roll-up would be shown a dashboard that only ever 403s.
 */
export default function AdminUsagePage() {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-strong">Usage</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Page views and key actions recorded by the app itself. Staff traffic
            is attributed to the person; storefront traffic is anonymous and
            appears only in the role split.
          </p>
        </div>
        <Link
          href="/admin/modules"
          className="inline-flex shrink-0 items-center gap-1 rounded-sm text-sm text-brand underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Module access
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </header>

      <ManageSystemGate action="read the usage roll-up">
        <UsageDashboard />
      </ManageSystemGate>
    </div>
  );
}
