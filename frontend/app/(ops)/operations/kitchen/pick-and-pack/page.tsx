'use client';

import { PickAndPackBoard } from '@/components/ops/kitchen/pick-and-pack/PickAndPackBoard';

export default function PickAndPackPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Pick & Pack</h1>
      <PickAndPackBoard />
    </div>
  );
}
