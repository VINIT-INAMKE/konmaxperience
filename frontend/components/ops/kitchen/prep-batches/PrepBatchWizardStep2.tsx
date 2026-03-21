'use client';

import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DeductionPreviewLine } from '@/lib/types/kitchen';

interface PrepBatchWizardStep2Props {
  previewLines: DeductionPreviewLine[];
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

export function PrepBatchWizardStep2({
  previewLines,
  isLoading,
  onNext,
  onBack,
}: PrepBatchWizardStep2Props) {
  const allSufficient = previewLines.every((l) => l.sufficient);
  const hasInsufficient = previewLines.some((l) => !l.sufficient);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        <span className="text-sm">Loading deduction preview...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Insufficient stock warning */}
      {hasInsufficient && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="size-4 text-destructive" />
          <AlertDescription className="text-destructive">
            Insufficient stock — check inventory before starting this batch
          </AlertDescription>
        </Alert>
      )}

      {/* Deduction preview table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Input
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Available
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Required
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Unit
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {previewLines.map((line, i) => (
              <tr
                key={i}
                className={`border-b ${
                  !line.sufficient
                    ? 'bg-destructive/10 text-destructive'
                    : ''
                }`}
              >
                <td className="px-4 py-2 text-sm">{line.input_name}</td>
                <td className="px-4 py-2 text-sm tabular-nums">{line.available}</td>
                <td className="px-4 py-2 text-sm tabular-nums">{line.required}</td>
                <td className="px-4 py-2 text-sm">{line.unit}</td>
                <td className="px-4 py-2">
                  {line.sufficient ? (
                    <Badge variant="secondary" className="text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950">
                      <Check className="size-3 mr-1" />
                      OK
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-destructive bg-destructive/10">
                      Insufficient
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex-1" />
        {!allSufficient ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground opacity-50 cursor-not-allowed"
              >
                Next
              </TooltipTrigger>
              <TooltipContent>
                <p>Insufficient stock for one or more inputs</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button onClick={onNext}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
