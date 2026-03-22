'use client';

import { CheckCircle } from 'lucide-react';
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress';
import { NumberTicker } from '@/components/ui/number-ticker';

interface QuestProgressProps {
  coreProgress: number;
  adhocProgress: number;
  baselineTaskCount: number;
  totalAdhocTasks: number;
}

export function QuestProgress({
  coreProgress,
  adhocProgress,
  baselineTaskCount,
  totalAdhocTasks,
}: QuestProgressProps) {
  const isComplete =
    coreProgress >= 100 && (totalAdhocTasks === 0 || adhocProgress >= 100);

  if (isComplete && baselineTaskCount > 0) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle className="size-4 text-green-400" />
        <span className="text-xs text-green-400">Quest complete</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Core progress track */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Core tasks</span>
          <span className="text-xs font-semibold">
            <NumberTicker value={coreProgress} className="text-xs font-semibold" />
            <span>%</span>
          </span>
        </div>
        <Progress
          value={coreProgress}
          aria-label={`Core task progress: ${Math.round(coreProgress)}%`}
        >
          <ProgressTrack className="h-1.5">
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
      </div>

      {/* Ad-hoc progress track -- only shown when ad-hoc tasks exist */}
      {totalAdhocTasks > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Ad-hoc tasks
            </span>
            <span className="text-xs font-semibold">
              <NumberTicker value={adhocProgress} className="text-xs font-semibold" />
              <span>%</span>
            </span>
          </div>
          <Progress
            value={adhocProgress}
            aria-label={`Ad-hoc task progress: ${Math.round(adhocProgress)}%`}
          >
            <ProgressTrack className="h-1.5">
              <ProgressIndicator className="[&]:bg-amber-500" />
            </ProgressTrack>
          </Progress>
        </div>
      )}
    </div>
  );
}
