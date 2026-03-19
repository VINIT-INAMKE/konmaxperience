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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';

interface BlockerDialogProps {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlocked: () => void;
}

export function BlockerDialog({
  taskId,
  open,
  onOpenChange,
  onBlocked,
}: BlockerDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (reason.trim().length < 3) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/tasks/${taskId}/block`, { reason: reason.trim() });
      onBlocked();
      onOpenChange(false);
      setReason('');
    } catch {
      // Error stays in dialog
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a blocker</DialogTitle>
          <DialogDescription>
            What is blocking this task? Be specific so your admin can help
            resolve it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="blocker-reason">Blocker reason</Label>
          <Textarea
            id="blocker-reason"
            placeholder="e.g. Waiting for supplier confirmation on ingredient list"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Keep working
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || reason.trim().length < 3}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                Reporting...
              </>
            ) : (
              'Report blocker'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
