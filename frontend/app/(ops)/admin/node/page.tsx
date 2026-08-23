'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ManageSystemGate } from '@/components/ops/admin/ManageSystemGate';
import { NodeSettingsForm } from '@/components/ops/admin/NodeSettingsForm';

export default function AdminNodePage() {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-strong">Node settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            The operating node this deployment runs. Its time zone decides where
            every &ldquo;today&rdquo; boundary falls and its currency labels
            every price in the product.
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

      <ManageSystemGate action="change node settings">
        <NodeSettingsForm />
      </ManageSystemGate>
    </div>
  );
}
