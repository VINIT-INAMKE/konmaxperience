'use client';

import { useState, useRef } from 'react';
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
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';
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
  const confettiRef = useRef<ConfettiRef>(null);

  async function handleActivate() {
    setIsActivating(true);
    try {
      await apiClient.patch(`/quests/${questId}`, { status: 'active' });
      // Fire confetti on successful activation
      confettiRef.current?.fire({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      // Small delay so user sees confetti before dialog closes
      setTimeout(() => {
        onActivated();
        onOpenChange(false);
      }, 800);
    } catch {
      // Error handling -- dialog stays open
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <>
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
      <Confetti
        ref={confettiRef}
        manualstart
        className="pointer-events-none fixed inset-0 z-[200] h-full w-full"
      />
    </>
  );
}
