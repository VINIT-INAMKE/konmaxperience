'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { PrepBatchList } from '@/components/ops/kitchen/prep-batches/PrepBatchList';
import { PrepBatchWizard } from '@/components/ops/kitchen/prep-batches/PrepBatchWizard';

export default function PrepBatchesPage() {
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleWizardSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['prep-batches'] });
  };

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

        {/* Wizard Sheet */}
        <PrepBatchWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onSuccess={handleWizardSuccess}
        />
      </div>
    </BlurFade>
  );
}
