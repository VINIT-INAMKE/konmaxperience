'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiClient } from '@/lib/api-client';
import type { DeductionPreviewLine } from '@/lib/types/kitchen';
import { PrepBatchWizardStep1 } from './PrepBatchWizardStep1';
import { PrepBatchWizardStep2 } from './PrepBatchWizardStep2';
import { PrepBatchWizardStep3 } from './PrepBatchWizardStep3';

const STEP_LABELS = ['Create Prep Batch', 'Review Deductions', 'Confirm Batch'];

interface Recipe {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
}

interface PrepBatchWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PrepBatchWizard({ open, onOpenChange, onSuccess }: PrepBatchWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recipeId, setRecipeId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [previewLines, setPreviewLines] = useState<DeductionPreviewLine[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch recipes and zones for name lookups
  const { data: recipes } = useQuery({
    queryKey: ['recipes', 'approved'],
    queryFn: () => apiClient.get<Recipe[]>('/recipes?status=approved'),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  const recipeName = recipes?.find((r) => r.id === recipeId)?.name ?? '';
  const zoneName = zones?.find((z) => z.id === zoneId)?.name ?? '';

  const resetWizard = () => {
    setStep(1);
    setRecipeId('');
    setQuantity('');
    setZoneId('');
    setPreviewLines([]);
    setIsLoadingPreview(false);
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetWizard();
    }
    onOpenChange(nextOpen);
  };

  const handleStep1Next = async () => {
    setIsLoadingPreview(true);
    setStep(2);
    try {
      const lines = await apiClient.post<DeductionPreviewLine[]>(
        '/kitchen/prep-batches/preview',
        {
          recipe_id: recipeId,
          zone_id: zoneId,
          quantity_to_prep: Number(quantity),
        },
      );
      setPreviewLines(lines);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load deduction preview.';
      toast.error(msg);
      setStep(1);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleStep2Next = () => {
    setStep(3);
  };

  const handleStep2Back = () => {
    setStep(1);
  };

  const handleStep3Back = () => {
    setStep(2);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/kitchen/prep-batches', {
        recipe_id: recipeId,
        zone_id: zoneId,
        quantity_to_prep: Number(quantity),
      });
      toast.success('Prep batch started.');
      onSuccess();
      handleOpenChange(false);
    } catch {
      toast.error('Failed to start batch. Check stock levels and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[520px] flex flex-col h-full overflow-hidden">
        <SheetHeader>
          <SheetTitle>{STEP_LABELS[step - 1]}</SheetTitle>
        </SheetHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-4 py-3">
          {STEP_LABELS.map((label, i) => {
            const stepNum = (i + 1) as 1 | 2 | 3;
            const isActive = step === stepNum;
            const isCompleted = step > stepNum;

            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={[
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors',
                      isActive
                        ? 'bg-primary border-primary text-primary-foreground'
                        : isCompleted
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-background border-muted-foreground/30 text-muted-foreground',
                    ].join(' ')}
                  >
                    {isCompleted ? <Check className="size-3.5" /> : stepNum}
                  </div>
                  <span
                    className={[
                      'text-[11px] mt-1 whitespace-nowrap',
                      isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={[
                      'flex-1 h-px mx-2 mb-4',
                      isCompleted ? 'bg-primary' : 'bg-muted-foreground/20',
                    ].join(' ')}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {step === 1 && (
            <PrepBatchWizardStep1
              recipeId={recipeId}
              setRecipeId={setRecipeId}
              quantity={quantity}
              setQuantity={setQuantity}
              zoneId={zoneId}
              setZoneId={setZoneId}
              onNext={() => void handleStep1Next()}
            />
          )}
          {step === 2 && (
            <PrepBatchWizardStep2
              previewLines={previewLines}
              isLoading={isLoadingPreview}
              onNext={handleStep2Next}
              onBack={handleStep2Back}
            />
          )}
          {step === 3 && (
            <PrepBatchWizardStep3
              recipeName={recipeName}
              quantity={quantity}
              zoneName={zoneName}
              previewLines={previewLines}
              onConfirm={() => void handleConfirm()}
              onBack={handleStep3Back}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
