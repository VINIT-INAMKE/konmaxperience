'use client';

import { KdsBoard } from '@/components/ops/kitchen/kds/KdsBoard';
import { KdsMetricsBar } from '@/components/ops/kitchen/kds/KdsMetricsBar';
import { KdsExitButton } from '@/components/ops/kitchen/kds/KdsExitButton';

export default function KdsPage() {
  return (
    <div className="fixed inset-0 z-50 bg-[oklch(0.10_0_0)] overflow-hidden flex flex-col">
      {/* Top bar: title + metrics + exit */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-2xl font-bold text-white">Kitchen Display</h1>
        <KdsMetricsBar />
        <KdsExitButton />
      </div>

      {/* Zone columns */}
      <div className="flex-1 overflow-y-auto p-4">
        <KdsBoard />
      </div>
    </div>
  );
}
