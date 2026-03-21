'use client';

import { useState } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { PrepBatchList } from '@/components/ops/kitchen/prep-batches/PrepBatchList';

export default function PrepBatchesPage() {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <BlurFade>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-semibold">Prep Batches</h1>
          <Button onClick={() => setWizardOpen(true)}>
            New Batch
          </Button>
        </div>

        {/* Prep batch list */}
        <PrepBatchList />
      </div>
    </BlurFade>
  );
}
