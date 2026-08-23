'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface ConfirmActivateDialogProps {
  questId: string;
  questTitle: string;
  coreTaskCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated: () => void;
}

export function ConfirmActivateDialog({
  questId,
  questTitle,
  coreTaskCount,
  open,
  onOpenChange,
  onActivated,
}: ConfirmActivateDialogProps) {
  const [isActivating, setIsActivating] = useState(false);

  async function handleActivate() {
    setIsActivating(true);
    try {
      await apiClient.patch(`/quests/${questId}`, { status: 'active' });
      onActivated();
      onOpenChange(false);
    } catch {
      // Error handling -- dialog stays open
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activate quest</DialogTitle>
          <DialogDescription>
            This will lock the baseline task count at{' '}
            <span className="font-semibold text-foreground">
              {coreTaskCount} core tasks
            </span>
            . Core progress will be calculated from this number. You can still
            add ad-hoc tasks after activation.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isActivating}
          >
            Keep as planned
          </Button>
          <Button onClick={handleActivate} disabled={isActivating}>
            {isActivating ? (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                Activating...
              </>
            ) : (
              'Activate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
