'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DeductionPreviewLine } from '@/lib/types/kitchen';

interface PrepBatchWizardStep3Props {
  recipeName: string;
  quantity: string;
  zoneName: string;
  previewLines: DeductionPreviewLine[];
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function PrepBatchWizardStep3({
  recipeName,
  quantity,
  zoneName,
  previewLines,
  onConfirm,
  onBack,
  isSubmitting,
}: PrepBatchWizardStep3Props) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Batch Summary</h3>
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-sm text-muted-foreground">Recipe</dt>
            <dd className="text-sm font-medium">{recipeName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-muted-foreground">Quantity</dt>
            <dd className="text-sm font-medium tabular-nums">{quantity}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-muted-foreground">Zone</dt>
            <dd className="text-sm font-medium">{zoneName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-muted-foreground">Inputs to deduct</dt>
            <dd className="text-sm font-medium tabular-nums">{previewLines.length}</dd>
          </div>
        </dl>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <div className="flex-1" />
        <Button onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Starting...
            </span>
          ) : (
            'Start Batch'
          )}
        </Button>
      </div>
    </div>
  );
}
