'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ManageSystemGate } from '@/components/ops/admin/ManageSystemGate';
import { ModuleAccessEditor } from '@/components/ops/admin/ModuleAccessEditor';

export default function AdminModulesPage() {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-strong">Module access</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Module visibility is a data layer of its own: a role sees a screen
            only when the module is enabled and that role is ticked.
            Permissions still decide what a role may <em>do</em> once inside.
          </p>
        </div>
        <Link
          href="/admin/node"
          className="inline-flex shrink-0 items-center gap-1 rounded-sm text-sm text-brand underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Node settings
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </header>

      <ManageSystemGate action="edit module access">
        <ModuleAccessEditor />
      </ManageSystemGate>
    </div>
  );
}
